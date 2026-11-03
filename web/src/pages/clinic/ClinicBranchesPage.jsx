import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic, useClinicAccess } from '../../layouts/ClinicLayout';
import { ClinicProfileTabs } from '../../components/clinic/ClinicUi';
import { Badge, Checkbox, DataTable, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import WeeklyHoursEditor from '../../components/portal/WeeklyHoursEditor';
import { QueryState } from '../../components/StatusMessage';
import {
  createBranch,
  createHoliday,
  createScheduleBlock,
  deleteHoliday,
  deleteScheduleBlock,
  getBranches,
  getClinicDentists,
  getHolidays,
  getScheduleBlocks,
  updateBranch,
  updateBranchHours,
} from '../../services/clinicPortalApi';
import { summarizeHours } from '../../services/adapters';
import { formatDateTime } from '../../utils/dateTime';

function BranchModal({ branch, onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: branch?.name ?? '',
    address: branch?.address ?? '',
    city: branch?.city ?? '',
    contact_number: branch?.contact_number ?? '',
    latitude: branch?.latitude ?? '',
    longitude: branch?.longitude ?? '',
    is_active: branch?.is_active ?? true,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, latitude: form.latitude === '' ? null : Number(form.latitude), longitude: form.longitude === '' ? null : Number(form.longitude) };
      return branch ? updateBranch(clinicId, branch.id, body) : createBranch(clinicId, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'branches'] });
      onClose();
    },
  });
  const bind = (name) => ({ value: form[name] ?? '', onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <Modal title={branch ? `Edit ${branch.name}` : 'Add branch'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="portal-form-grid">
          <Field label="Name" required {...bind('name')} />
          <Field label="Contact number" type="tel" {...bind('contact_number')} />
          <Field label="Street address" required className="is-wide" {...bind('address')} />
          <Field label="City / municipality" required {...bind('city')} />
          <span />
          <Field label="Latitude" type="number" step="any" hint="For the map, e.g. 8.1575" {...bind('latitude')} />
          <Field label="Longitude" type="number" step="any" hint="e.g. 125.1278" {...bind('longitude')} />
          <div className="is-wide">
            <Checkbox label="Open for bookings" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          </div>
        </div>
        <FormError error={save.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

function HoursModal({ branch, onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const [hours, setHours] = useState(() =>
    Object.fromEntries((branch.operating_hours ?? []).map((h) => [h.day_of_week, { start: h.opens_at, end: h.closes_at }]))
  );
  const save = useMutation({
    mutationFn: () =>
      updateBranchHours(
        clinicId,
        branch.id,
        Object.entries(hours).map(([day, h]) => ({ day_of_week: Number(day), opens_at: h.start, closes_at: h.end }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'branches'] });
      onClose();
    },
  });

  return (
    <Modal title={`Opening hours — ${branch.name}`} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <WeeklyHoursEditor idPrefix={`branch-${branch.id}`} value={hours} onChange={setHours} />
        <FormError error={save.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>Save hours</button>
        </div>
      </form>
    </Modal>
  );
}

function Branches() {
  const { clinicId, can } = useClinic();
  // ?new=1 (the sidebar's Add New Branch) opens the add-branch form.
  const [searchParams] = useSearchParams();
  const [modal, setModal] = useState(() =>
    searchParams.get('new') === '1' && can('clinic.branches.manage') ? { type: 'branch' } : null
  );
  const query = useQuery({ queryKey: ['clinic', clinicId, 'branches'], queryFn: () => getBranches(clinicId) });

  return (
    <Section
      title="Branches & opening hours"
      actions={can('clinic.branches.manage') && <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'branch' })}>Add branch</button>}
    >
      <QueryState query={query} loadingLabel="Loading branches…">
        {(branches) => (
          <DataTable
            caption="Branches"
            rows={branches}
            columns={[
              { key: 'name', label: 'Branch', render: (b) => <>{b.name} {b.is_main && <Badge tone="info">Main</Badge>}</> },
              { key: 'address', label: 'Address', render: (b) => `${b.address}, ${b.city}` },
              { key: 'hours', label: 'Hours', render: (b) => summarizeHours(b.operating_hours) || 'Closed' },
              { key: 'state', label: 'Status', render: (b) => <Badge tone={b.is_active ? 'success' : 'neutral'}>{b.is_active ? 'Open' : 'Inactive'}</Badge> },
              {
                key: 'actions',
                label: '',
                render: (b) => (
                  <div className="portal-actions">
                    {can('clinic.branches.manage') && <button type="button" className="btn btn-outline btn-sm" onClick={() => setModal({ type: 'branch', branch: b })}>Edit</button>}
                    {can('clinic.schedules.manage') && <button type="button" className="btn btn-outline btn-sm" onClick={() => setModal({ type: 'hours', branch: b })}>Hours</button>}
                  </div>
                ),
              },
            ]}
          />
        )}
      </QueryState>
      {modal?.type === 'branch' && <BranchModal branch={modal.branch} onClose={() => setModal(null)} />}
      {modal?.type === 'hours' && <HoursModal branch={modal.branch} onClose={() => setModal(null)} />}
    </Section>
  );
}

function ClosedDates() {
  const { clinicId, can } = useClinic();
  const queryClient = useQueryClient();
  const canManage = can('clinic.schedules.manage');
  const holidays = useQuery({ queryKey: ['clinic', clinicId, 'holidays'], queryFn: () => getHolidays(clinicId) });
  const blocks = useQuery({ queryKey: ['clinic', clinicId, 'blocks'], queryFn: () => getScheduleBlocks(clinicId) });
  const dentists = useQuery({ queryKey: ['clinic', clinicId, 'dentists'], queryFn: () => getClinicDentists(clinicId), enabled: canManage });
  const [holiday, setHoliday] = useState({ date: '', name: '' });
  const [block, setBlock] = useState({ starts_at: '', ends_at: '', dentist_id: '', reason: '' });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
  const addHoliday = useMutation({ mutationFn: () => createHoliday(clinicId, holiday), onSuccess: () => { setHoliday({ date: '', name: '' }); refresh(); } });
  const removeHoliday = useMutation({ mutationFn: (id) => deleteHoliday(clinicId, id), onSuccess: refresh });
  const addBlock = useMutation({
    mutationFn: () => createScheduleBlock(clinicId, { ...block, dentist_id: block.dentist_id ? Number(block.dentist_id) : null, reason: block.reason || null }),
    onSuccess: () => { setBlock({ starts_at: '', ends_at: '', dentist_id: '', reason: '' }); refresh(); },
  });
  const removeBlock = useMutation({ mutationFn: (id) => deleteScheduleBlock(clinicId, id), onSuccess: refresh });

  return (
    <div className="portal-grid-2">
      <Section title="Holidays" subtitle="No bookings on these dates (all branches).">
        <QueryState query={holidays} loadingLabel="Loading…">
          {(list) => (
            <DataTable
              caption="Holidays"
              rows={list}
              emptyText="No holidays set."
              columns={[
                { key: 'date', label: 'Date' },
                { key: 'name', label: 'Name' },
                { key: 'x', label: '', render: (h) => canManage && <button type="button" className="btn btn-outline btn-sm" onClick={() => removeHoliday.mutate(h.id)}>Remove</button> },
              ]}
            />
          )}
        </QueryState>
        {canManage && (
          <form className="portal-toolbar portal-spaced-top" onSubmit={(e) => { e.preventDefault(); addHoliday.mutate(); }}>
            <Field label="Date" type="date" required value={holiday.date} onChange={(e) => setHoliday((h) => ({ ...h, date: e.target.value }))} />
            <Field label="Name" required value={holiday.name} onChange={(e) => setHoliday((h) => ({ ...h, name: e.target.value }))} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={addHoliday.isPending}>Add</button>
          </form>
        )}
        <FormError error={addHoliday.error || removeHoliday.error} />
      </Section>

      <Section title="Blocked time" subtitle="Leave, meetings or equipment downtime. Existing appointments are not moved.">
        <QueryState query={blocks} loadingLabel="Loading…">
          {(list) => (
            <DataTable
              caption="Blocked time"
              rows={list}
              emptyText="Nothing blocked."
              columns={[
                { key: 'starts_at', label: 'From', render: (b) => formatDateTime(b.starts_at) },
                { key: 'ends_at', label: 'To', render: (b) => formatDateTime(b.ends_at) },
                { key: 'who', label: 'Applies to', render: (b) => (b.dentist_id ? dentists.data?.find((d) => d.id === b.dentist_id)?.name ?? 'Dentist' : 'Whole clinic') },
                { key: 'reason', label: 'Reason', render: (b) => b.reason ?? '—' },
                { key: 'x', label: '', render: (b) => canManage && <button type="button" className="btn btn-outline btn-sm" onClick={() => removeBlock.mutate(b.id)}>Remove</button> },
              ]}
            />
          )}
        </QueryState>
        {canManage && (
          <form className="portal-form-grid portal-spaced-top" onSubmit={(e) => { e.preventDefault(); addBlock.mutate(); }}>
            <Field label="From" type="datetime-local" required value={block.starts_at} onChange={(e) => setBlock((b) => ({ ...b, starts_at: e.target.value }))} />
            <Field label="To" type="datetime-local" required value={block.ends_at} onChange={(e) => setBlock((b) => ({ ...b, ends_at: e.target.value }))} />
            <Field
              label="Dentist"
              as="select"
              options={[{ value: '', label: 'Whole clinic' }, ...(dentists.data ?? []).map((d) => ({ value: String(d.id), label: d.name }))]}
              value={block.dentist_id}
              onChange={(e) => setBlock((b) => ({ ...b, dentist_id: e.target.value }))}
            />
            <Field label="Reason" value={block.reason} onChange={(e) => setBlock((b) => ({ ...b, reason: e.target.value }))} />
            <div className="is-wide portal-form-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={addBlock.isPending}>Block time</button>
            </div>
          </form>
        )}
        <FormError error={addBlock.error || removeBlock.error} />
      </Section>
    </div>
  );
}

function ClinicBranchesPage() {
  const { clinicId, can } = useClinicAccess();
  return (
    <ClinicLayout section="branches" title="Clinic Profile" subtitle="Branches & Hours" requires={['clinic.branches.manage', 'clinic.schedules.manage']}>
      <ClinicProfileTabs clinicId={clinicId} can={can} active="branches" />
      <div className="portal-stack">
        <Branches />
        <ClosedDates />
      </div>
    </ClinicLayout>
  );
}

export default ClinicBranchesPage;
