import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { TableFooter } from '../../../components/admin/AdminData';
import { FilterSelect, InitialsTile, Pill } from '../../../components/clinic/ClinicUi';
import { Field, FormError, Modal } from '../../../components/portal/PortalUi';
import { QueryState } from '../../../components/StatusMessage';
import { createFollowUp, getFollowUps, updateFollowUp } from '../../../services/dentistApi';
import { businessTodayKey } from '../../../utils/dateTime';
import { formatDay, PatientSelect } from './dentistUi';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const PAGE_SIZE = 50;

const STATUSES = [
  { value: 'scheduled', label: 'Scheduled', tone: 'warning' },
  { value: 'confirmed', label: 'Confirmed', tone: 'info' },
  { value: 'completed', label: 'Completed', tone: 'success' },
  { value: 'cancelled', label: 'Cancelled', tone: 'neutral' },
];

const PRIORITIES = [
  { value: 'routine', label: 'Routine', tone: 'info' },
  { value: 'high', label: 'High', tone: 'danger' },
];

const pill = (list, value) => {
  const item = list.find((entry) => entry.value === value);
  return <Pill tone={item?.tone ?? 'neutral'}>{item?.label ?? value}</Pill>;
};

function FollowUpModal({ clinicId, followUp, onClose }) {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState('');
  const [form, setForm] = useState({
    purpose: followUp?.purpose ?? '',
    due_on: followUp?.due_on ?? '',
    priority: followUp?.priority ?? 'routine',
    status: followUp?.status ?? 'scheduled',
    notes: followUp?.notes ?? '',
  });
  const change = (name) => (event) => setForm((f) => ({ ...f, [name]: event.target.value }));
  const save = useMutation({
    mutationFn: () => (followUp ? updateFollowUp(clinicId, followUp.id, form) : createFollowUp(clinicId, { patient_id: patientId, ...form })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'dentist', 'overview'] });
      onClose();
    },
  });
  return (
    <Modal title={followUp ? `Follow-up: ${followUp.patient?.name}` : 'Schedule Follow-up'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        {!followUp && <PatientSelect clinicId={clinicId} value={patientId} onChange={setPatientId} />}
        <Field label="Purpose" required maxLength={255} placeholder="e.g. Retainer check" value={form.purpose} onChange={change('purpose')} />
        <div className="dentist-form-row">
          <Field label="Due Date" type="date" required min={followUp ? undefined : businessTodayKey()} value={form.due_on} onChange={change('due_on')} />
          <Field label="Priority" as="select" value={form.priority} onChange={change('priority')} options={PRIORITIES} />
        </div>
        {followUp && <Field label="Status" as="select" value={form.status} onChange={change('status')} options={STATUSES} />}
        <Field label="Notes" as="textarea" rows={2} maxLength={500} value={form.notes} onChange={change('notes')} />
        <FormError error={save.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={(!followUp && !patientId) || !form.purpose.trim() || !form.due_on || save.isPending}>
            {save.isPending ? 'Saving…' : followUp ? 'Save Changes' : 'Schedule Follow-up'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Tile({ icon, tone, value, label }) {
  return (
    <div className="dentist-followup-tile">
      <span className={`clinic-tile-icon is-${tone}`} aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div>
        <p className="dentist-followup-value">{value}</p>
        <p className="dentist-row-sub">{label}</p>
      </div>
    </div>
  );
}

/** Follow-up Management: who should come back, when, and how much it matters. */
function FollowUpsPage() {
  const { clinicId, can } = useClinicAccess();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'follow-ups', status, page],
    queryFn: () => getFollowUps(clinicId, { status: status || undefined, page, per_page: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const summary = query.data?.meta?.summary;

  return (
    <ClinicLayout
      section="follow-ups"
      title="Follow-up Management"
      subtitle={summary ? `${summary.total} scheduled ${summary.total === 1 ? 'follow-up' : 'follow-ups'}` : null}
      requires={['records.view']}
      hideSearch
      headerActions={
        <>
          <FilterSelect
            label="Filter by status"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[{ value: '', label: 'All' }, ...STATUSES]}
          />
          {can('records.write') && (
            <button type="button" className="btn btn-primary clinic-header-button" onClick={() => setModal({})}>
              <Icon name="plus" size={18} />
              Schedule Follow-up
            </button>
          )}
        </>
      }
    >
      {summary && (
        <div className="dentist-followup-tiles">
          <Tile icon="calendarPlus" tone="blue" value={summary.total} label="Total Scheduled" />
          <Tile icon="alertTriangle" tone="red" value={summary.high_priority} label="High Priority" />
          <Tile icon="checkCircle" tone="green" value={summary.confirmed} label="Confirmed" />
        </div>
      )}
      <QueryState query={query} loadingLabel="Loading follow-ups…">
        {({ items, meta }) =>
          items.length === 0 ? (
            <p className="portal-empty">{status ? 'No follow-ups with this status.' : 'No follow-ups scheduled yet.'}</p>
          ) : (
            <>
              <div className="dentist-table-wrap">
                <table className="dentist-table">
                  <thead>
                    <tr>
                      <th scope="col">Patient</th>
                      <th scope="col">Purpose</th>
                      <th scope="col">Due Date</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Status</th>
                      <th scope="col">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((followUp) => (
                      <tr key={followUp.id} onClick={() => can('records.write') && setModal({ followUp })}>
                        <td>
                          <button type="button" className="dentist-table-patient" aria-label={`Edit follow-up for ${followUp.patient?.name}`} disabled={!can('records.write')} onClick={(event) => {
                            event.stopPropagation();
                            setModal({ followUp });
                          }}>
                            <InitialsTile name={followUp.patient?.name} size="sm" tone="navy" />
                            {followUp.patient?.name}
                          </button>
                        </td>
                        <td>{followUp.purpose}</td>
                        <td>{formatDay(followUp.due_on)}</td>
                        <td>{pill(PRIORITIES, followUp.priority)}</td>
                        <td>{pill(STATUSES, followUp.status)}</td>
                        <td className="dentist-row-sub">{followUp.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TableFooter meta={meta} perPage={PAGE_SIZE} onPageChange={setPage} noun="follow-ups" label="Follow-up pages" />
            </>
          )
        }
      </QueryState>
      {modal && <FollowUpModal clinicId={clinicId} followUp={modal.followUp} onClose={() => setModal(null)} />}
    </ClinicLayout>
  );
}

export default FollowUpsPage;
