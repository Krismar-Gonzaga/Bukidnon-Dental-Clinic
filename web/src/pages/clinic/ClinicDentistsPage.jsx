import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic, useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { InviteByEmailModal } from '../../components/clinic/ClinicAdminUi';
import { FilterSelect, InitialsTile, Pill, SearchInput } from '../../components/clinic/ClinicUi';
import ScheduleApprovals from '../../components/clinic/ScheduleApprovals';
import { Checkbox, ConfirmDialog, Field, FormError, Modal } from '../../components/portal/PortalUi';
import WeeklyHoursEditor from '../../components/portal/WeeklyHoursEditor';
import { QueryState } from '../../components/StatusMessage';
import {
  getBranches,
  getClinicDentists,
  getSpecializationOptions,
  updateDentist,
  updateDentistSchedules,
} from '../../services/clinicPortalApi';
import { getClinicHref } from '../../config/clinicNavigation';
import { businessTodayKey, dateFromKey, formatClockTime } from '../../utils/dateTime';
import './ClinicDentistsPage.css';

export function ProfileModal({ dentist, onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const specializations = useQuery({ queryKey: ['specializations'], queryFn: getSpecializationOptions, staleTime: 10 * 60 * 1000 });
  const [form, setForm] = useState({
    specialization_id: dentist.specialization_id ? String(dentist.specialization_id) : '',
    license_number: dentist.license_number ?? '',
    ptr_number: dentist.ptr_number ?? '',
    s2_number: dentist.s2_number ?? '',
    years_experience: String(dentist.years_experience ?? 0),
    qualifications: dentist.qualifications ?? '',
    bio: dentist.bio ?? '',
    is_active: dentist.is_active,
  });
  const save = useMutation({
    mutationFn: () =>
      updateDentist(clinicId, dentist.id, {
        ...form,
        specialization_id: form.specialization_id ? Number(form.specialization_id) : null,
        years_experience: Number(form.years_experience),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      onClose();
    },
  });
  const bind = (name) => ({ value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <Modal title={`Profile — ${dentist.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="portal-form-grid">
          <Field
            label="Specialization"
            as="select"
            options={[{ value: '', label: 'General' }, ...(specializations.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))]}
            {...bind('specialization_id')}
          />
          <Field label="PRC license number" {...bind('license_number')} />
          <Field label="PTR number" maxLength={50} {...bind('ptr_number')} />
          <Field label="S2 number" maxLength={50} {...bind('s2_number')} />
          <Field label="Years of experience" type="number" min="0" max="70" {...bind('years_experience')} />
          <Field label="Qualifications" as="textarea" className="is-wide" {...bind('qualifications')} />
          <Field label="Public bio" as="textarea" className="is-wide" {...bind('bio')} />
          <div className="is-wide">
            <Checkbox label="Accepting bookings" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
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

export function ScheduleModal({ dentist, branches, onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState(String(branches[0]?.id ?? ''));
  // { [branchId]: { [day]: { start, end } } }
  const [byBranch, setByBranch] = useState(() => {
    const initial = {};
    (dentist.schedules ?? []).forEach((s) => {
      initial[s.branch_id] = { ...(initial[s.branch_id] ?? {}), [s.day_of_week]: { start: s.starts_at, end: s.ends_at } };
    });
    return initial;
  });

  const save = useMutation({
    mutationFn: () =>
      updateDentistSchedules(
        clinicId,
        dentist.id,
        Object.entries(byBranch).flatMap(([branch, days]) =>
          Object.entries(days).map(([day, h]) => ({ branch_id: Number(branch), day_of_week: Number(day), starts_at: h.start, ends_at: h.end }))
        )
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      onClose();
    },
  });

  return (
    <Modal title={`Weekly schedule — ${dentist.name}`} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        {branches.length > 1 && (
          <Field
            label="Branch"
            as="select"
            options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          />
        )}
        <p className="portal-field-hint portal-spaced-top-sm">
          Bookings are offered only inside both these hours and the branch's opening hours.
        </p>
        <WeeklyHoursEditor
          idPrefix={`schedule-${dentist.id}-${branchId}`}
          value={byBranch[branchId] ?? {}}
          onChange={(days) => setByBranch((current) => ({ ...current, [branchId]: days }))}
        />
        <FormError error={save.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>Save schedule</button>
        </div>
      </form>
    </Modal>
  );
}

const hoursToday = (schedules = []) => {
  const day = dateFromKey(businessTodayKey()).getDay();
  const today = schedules.filter((entry) => entry.day_of_week === day);
  if (today.length === 0) return schedules.length === 0 ? 'No schedule yet' : 'Off today';
  const start = today.map((entry) => entry.starts_at).sort()[0];
  const end = today.map((entry) => entry.ends_at).sort().at(-1);
  return `${formatClockTime(start)} – ${formatClockTime(end)}`;
};

function DentistCard({ dentist, canEdit, profileHref, onEdit, onToggle }) {
  return (
    <li className="clinic-dentist-card">
      <InitialsTile name={dentist.name} id={dentist.id} />
      <div className="clinic-dentist-body">
        <div className="clinic-dentist-head">
          <div>
            <h2 className="clinic-dentist-name">{dentist.name}</h2>
            <p className="clinic-cell-sub clinic-dentist-specialty">{dentist.specialization ?? 'General Dentist'}</p>
          </div>
          <Pill tone={dentist.is_active ? 'success' : 'neutral'}>{dentist.is_active ? 'Active' : 'Inactive'}</Pill>
        </div>
        <p className="clinic-dentist-meta">
          <span>
            <Icon name="calendarBlank" size={16} />
            {dentist.appointments_today ?? 0} today
          </span>
          <span>
            <Icon name="clock" size={16} />
            {hoursToday(dentist.schedules)}
          </span>
        </p>
        <div className="clinic-dentist-actions">
          <a href={profileHref} className="clinic-mini-button is-primary clinic-dentist-view" aria-label={`View profile of ${dentist.name}`}>
            View Profile
          </a>
          {canEdit && (
            <>
              <button type="button" className="clinic-dentist-edit" onClick={onEdit} aria-label={`Edit ${dentist.name}`}>
                <Icon name="pencil" size={18} />
              </button>
              <button
                type="button"
                className={`clinic-mini-button ${dentist.is_active ? 'is-danger' : 'is-positive'}`}
                onClick={onToggle}
                aria-label={`${dentist.is_active ? 'Deactivate' : 'Activate'} ${dentist.name}`}
              >
                {dentist.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function Dentists({ query, search, setSearch }) {
  const { clinicId, can } = useClinic();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const [specialty, setSpecialty] = useState('');
  const [status, setStatus] = useState('');
  const [toggling, setToggling] = useState(null);
  const branches = useQuery({ queryKey: ['clinic', clinicId, 'branches'], queryFn: () => getBranches(clinicId) });
  const toggle = useMutation({
    mutationFn: () => updateDentist(clinicId, toggling.id, { is_active: !toggling.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      setToggling(null);
    },
  });
  const list = query.data ?? [];
  const specialties = [...new Set(list.map((d) => d.specialization ?? 'General Dentist'))].sort();
  const term = search.trim().toLowerCase();
  const visible = list.filter(
    (d) =>
      (!term || `${d.name} ${d.email ?? ''} ${d.specialization ?? ''}`.toLowerCase().includes(term)) &&
      (!specialty || (d.specialization ?? 'General Dentist') === specialty) &&
      (!status || (status === 'active') === d.is_active)
  );

  return (
    <>
      {can('clinic.schedules.manage') && <ScheduleApprovals clinicId={clinicId} />}
      <div className="clinic-toolbar">
        <SearchInput label="Search dentists" placeholder="Search dentists..." value={search} onChange={setSearch} />
        <FilterSelect label="Specialization" value={specialty} onChange={setSpecialty} options={[{ value: '', label: 'All specializations' }, ...specialties.map((value) => ({ value, label: value }))]} />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </div>
      <QueryState query={query} loadingLabel="Loading dentists…">
        {() =>
          visible.length === 0 ? (
            <p className="portal-empty">{list.length === 0 ? 'No dentists yet. Use Add Dentist to invite one.' : 'No dentists match these filters.'}</p>
          ) : (
            <ul className="clinic-dentist-grid">
              {visible.map((dentist) => (
                <DentistCard
                  key={dentist.id}
                  dentist={dentist}
                  canEdit={can('clinic.dentists.manage')}
                  profileHref={`${getClinicHref(clinicId, 'dentists')}/${dentist.id}`}
                  onEdit={() => setModal({ type: 'profile', dentist })}
                  onToggle={() => {
                    toggle.reset();
                    setToggling(dentist);
                  }}
                />
              ))}
            </ul>
          )
        }
      </QueryState>
      {modal?.type === 'profile' && <ProfileModal dentist={modal.dentist} onClose={() => setModal(null)} />}
      {modal?.type === 'schedule' && <ScheduleModal dentist={modal.dentist} branches={branches.data ?? []} onClose={() => setModal(null)} />}
      {toggling && (
        <ConfirmDialog
          title={`${toggling.is_active ? 'Deactivate' : 'Activate'} ${toggling.name}?`}
          message={
            toggling.is_active
              ? 'Patients can no longer book this dentist. Existing appointments stay on the schedule.'
              : 'Patients can book this dentist again during their weekly hours.'
          }
          confirmLabel={toggling.is_active ? 'Deactivate' : 'Activate'}
          danger={toggling.is_active}
          isBusy={toggle.isPending}
          error={toggle.error}
          onConfirm={() => toggle.mutate()}
          onCancel={() => setToggling(null)}
        />
      )}
    </>
  );
}

function ClinicDentistsPage() {
  const { clinicId, membership, can } = useClinicAccess();
  const clinicName = membership?.clinic_name;
  const [search, setSearch] = useState('');
  const [inviting, setInviting] = useState(false);
  const allowed = can('clinic.dentists.manage', 'clinic.schedules.manage');
  const query = useQuery({ queryKey: ['clinic', clinicId, 'dentists'], queryFn: () => getClinicDentists(clinicId), enabled: allowed });
  const total = query.data?.length;

  return (
    <ClinicLayout
      section="dentists"
      title="Dentist Management"
      subtitle={total == null ? 'Loading dentists…' : `${total} ${total === 1 ? 'dentist' : 'dentists'} registered`}
      requires={['clinic.dentists.manage', 'clinic.schedules.manage']}
      hideSearch
      headerActions={
        can('clinic.staff.manage') && (
          <>
            <button type="button" className="btn btn-outline clinic-header-button" onClick={() => setInviting(true)}>
              <Icon name="mail" size={18} />
              Invite by Email
            </button>
            <a href={`${getClinicHref(clinicId, 'dentists')}/new`} className="btn btn-primary clinic-header-button">
              <Icon name="userPlus" size={18} />
              Add Dentist
            </a>
          </>
        )
      }
    >
      <Dentists query={query} search={search} setSearch={setSearch} />
      {inviting && <InviteByEmailModal clinicId={clinicId} clinicName={clinicName} role="dentist" title="Invite Dentist by Email" onClose={() => setInviting(false)} />}
    </ClinicLayout>
  );
}

export default ClinicDentistsPage;
