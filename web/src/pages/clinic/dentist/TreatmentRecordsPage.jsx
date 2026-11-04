import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ClinicLayout, { useClinicAccess } from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { TableFooter } from '../../../components/admin/AdminData';
import { BackLink, Card } from '../../../components/clinic/ClinicAdminUi';
import { FilterSelect } from '../../../components/clinic/ClinicUi';
import { Field, FormError } from '../../../components/portal/PortalUi';
import { QueryState } from '../../../components/StatusMessage';
import { getClinicHref } from '../../../config/clinicNavigation';
import { getRecordsOfKind, saveNewRecord } from '../../../services/dentistApi';
import { businessTodayKey, toBusinessDateKey } from '../../../utils/dateTime';
import { formatDay, PatientSelect, usePatientOptions } from './dentistUi';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const PAGE_SIZE = 20;

/** Treatment Records: the procedures done, with what was used. */
function TreatmentRecordsPage() {
  const { clinicId, can } = useClinicAccess();
  const [patient, setPatient] = useState('');
  const [page, setPage] = useState(1);
  const { patients } = usePatientOptions(clinicId);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'records', 'treatments', patient, page],
    queryFn: () => getRecordsOfKind(clinicId, 'treatments', { patient_id: patient || undefined, page, per_page: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.meta?.total;

  return (
    <ClinicLayout
      section="treatment-records"
      title="Treatment Records"
      subtitle={total != null ? `${total} ${total === 1 ? 'procedure' : 'procedures'} on record` : null}
      requires={['records.view']}
      hideSearch
      headerActions={
        <>
          <FilterSelect
            label="Filter by patient"
            value={patient}
            onChange={(value) => {
              setPatient(value);
              setPage(1);
            }}
            options={[{ value: '', label: 'All' }, ...patients.map((p) => ({ value: String(p.id), label: p.name }))]}
          />
          {can('records.write') && (
            <a href={`${getClinicHref(clinicId, 'treatment-records')}/new`} className="btn btn-primary clinic-header-button">
              <Icon name="plus" size={18} />
              Add Record
            </a>
          )}
        </>
      }
    >
      <QueryState query={query} loadingLabel="Loading treatment records…">
        {({ items, meta }) =>
          items.length === 0 ? (
            <p className="portal-empty">{patient ? 'No treatments recorded for this patient.' : 'No treatment records yet.'}</p>
          ) : (
            <>
              {items.map((record) => (
                <article key={record.id} className="dentist-list-card">
                  <div className="dentist-list-head">
                    <span className="dentist-list-icon" aria-hidden="true">
                      <Icon name="fileText" size={20} />
                    </span>
                    <div className="dentist-list-head-body">
                      <p className="dentist-row-title">{record.procedures || 'Treatment'}</p>
                      <p className="dentist-row-sub">
                        {record.patient?.name} · {formatDay(record.performed_on ?? toBusinessDateKey(record.created_at))}
                      </p>
                    </div>
                    {record.tooth_numbers && <span className="dentist-tag">{record.tooth_numbers}</span>}
                  </div>
                  <div className="dentist-list-fields">
                    <p><strong>Materials:</strong> {record.materials_used || '—'}</p>
                    <p><strong>Dentist:</strong> {record.dentist ?? record.author ?? '—'}</p>
                    {record.notes && <p className="dentist-list-wide"><strong>Remarks:</strong> {record.notes}</p>}
                  </div>
                </article>
              ))}
              <TableFooter meta={meta} perPage={PAGE_SIZE} onPageChange={setPage} noun="records" label="Record pages" />
            </>
          )
        }
      </QueryState>
    </ClinicLayout>
  );
}

export function TreatmentRecordFormPage() {
  const { clinicId } = useClinicAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [patientId, setPatientId] = useState(params.get('patient') ?? '');
  const [form, setForm] = useState({ performed_on: businessTodayKey(), procedures: '', tooth_numbers: '', materials_used: '', notes: '' });
  const listHref = getClinicHref(clinicId, 'treatment-records');
  const change = (name) => (event) => setForm((f) => ({ ...f, [name]: event.target.value }));
  const save = useMutation({
    mutationFn: () => saveNewRecord(clinicId, patientId, { record_type: 'treatment', ...form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'records'] });
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'patients'] });
      navigate(listHref);
    },
  });

  return (
    <ClinicLayout section="treatment-records" title="New Treatment Record" subtitle={null} requires={['records.write']} hideSearch>
      <div className="dentist-page-back">
        <BackLink href={listHref}>Back</BackLink>
      </div>
      <div className="dentist-narrower">
        <Card>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="dentist-form-row">
              <PatientSelect clinicId={clinicId} value={patientId} onChange={setPatientId} />
              <Field label="Date" type="date" required max={businessTodayKey()} value={form.performed_on} onChange={change('performed_on')} />
            </div>
            <div className="dentist-form-row">
              <Field label="Procedure" required maxLength={5000} placeholder="e.g. Tooth Extraction" value={form.procedures} onChange={change('procedures')} />
              <Field label="Tooth / Area" maxLength={255} placeholder="e.g. Tooth #14 or Full Mouth" value={form.tooth_numbers} onChange={change('tooth_numbers')} />
            </div>
            <Field label="Materials Used" maxLength={500} placeholder="e.g. Composite resin, NiTi wire" value={form.materials_used} onChange={change('materials_used')} />
            <Field label="Clinical Remarks" as="textarea" rows={4} maxLength={5000} placeholder="Post-procedure notes, patient response, etc." value={form.notes} onChange={change('notes')} />
            <FormError error={save.error} />
            <div className="dentist-actions-row">
              <button type="submit" className="btn btn-primary" disabled={!patientId || !form.procedures.trim() || save.isPending}>
                <Icon name="checkCircle" size={18} />
                {save.isPending ? 'Saving…' : 'Save Record'}
              </button>
              <a href={listHref} className="btn btn-outline">
                Cancel
              </a>
            </div>
          </form>
        </Card>
      </div>
    </ClinicLayout>
  );
}

export default TreatmentRecordsPage;
