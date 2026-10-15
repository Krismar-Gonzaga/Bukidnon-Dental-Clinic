import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import { Badge, Checkbox, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import WeeklyHoursEditor from '../../components/portal/WeeklyHoursEditor';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref } from '../../config/clinicNavigation';
import {
  getBranches,
  getClinicDentists,
  getSpecializationOptions,
  updateDentist,
  updateDentistSchedules,
} from '../../services/clinicPortalApi';
import { WEEKDAY_SHORT } from '../../utils/dateTime';

function ProfileModal({ dentist, onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const specializations = useQuery({ queryKey: ['specializations'], queryFn: getSpecializationOptions, staleTime: 10 * 60 * 1000 });
  const [form, setForm] = useState({
    specialization_id: dentist.specialization_id ? String(dentist.specialization_id) : '',
    license_number: dentist.license_number ?? '',
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
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'dentists'] });
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

function ScheduleModal({ dentist, branches, onClose }) {
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
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'dentists'] });
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

const summarize = (schedules, branches) =>
  branches
    .map((branch) => {
      const days = schedules.filter((s) => s.branch_id === branch.id).sort((a, b) => a.day_of_week - b.day_of_week);
      if (days.length === 0) return null;
      return `${branch.name}: ${days.map((d) => `${WEEKDAY_SHORT[d.day_of_week]} ${d.starts_at}–${d.ends_at}`).join(', ')}`;
    })
    .filter(Boolean)
    .join(' · ') || 'No schedule — not bookable';

function Dentists() {
  const { clinicId, can } = useClinic();
  const [modal, setModal] = useState(null);
  const dentists = useQuery({ queryKey: ['clinic', clinicId, 'dentists'], queryFn: () => getClinicDentists(clinicId) });
  const branches = useQuery({ queryKey: ['clinic', clinicId, 'branches'], queryFn: () => getBranches(clinicId) });

  return (
    <Section
      title="Dentists"
      subtitle="Dentists join through Staff (role: Dentist). Set their profile and weekly hours here."
      actions={can('clinic.staff.manage') && <a href={getClinicHref(clinicId, 'staff')} className="btn btn-outline btn-sm">Add a dentist</a>}
    >
      <QueryState query={dentists} loadingLabel="Loading dentists…">
        {(list) =>
          list.length === 0 ? (
            <p className="portal-empty">No dentists yet.</p>
          ) : (
            <ul className="portal-list">
              {list.map((dentist) => (
                <li key={dentist.id} className="portal-list-item">
                  <div className="portal-section-header">
                    <div>
                      <strong>{dentist.name}</strong> <Badge tone={dentist.is_active ? 'success' : 'neutral'}>{dentist.is_active ? 'Accepting bookings' : 'Inactive'}</Badge>
                      <p className="portal-list-item-meta">
                        {dentist.specialization ?? 'General'} · {dentist.years_experience} yrs{dentist.license_number && ` · PRC ${dentist.license_number}`}
                      </p>
                      <p className="portal-list-item-meta">{summarize(dentist.schedules ?? [], branches.data ?? [])}</p>
                    </div>
                    <div className="portal-actions">
                      {can('clinic.dentists.manage') && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setModal({ type: 'profile', dentist })}>Edit profile</button>
                      )}
                      {can('clinic.schedules.manage') && (
                        <button type="button" className="btn btn-outline btn-sm" disabled={!branches.data} onClick={() => setModal({ type: 'schedule', dentist })}>Edit schedule</button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
      {modal?.type === 'profile' && <ProfileModal dentist={modal.dentist} onClose={() => setModal(null)} />}
      {modal?.type === 'schedule' && <ScheduleModal dentist={modal.dentist} branches={branches.data ?? []} onClose={() => setModal(null)} />}
    </Section>
  );
}

function ClinicDentistsPage() {
  return (
    <ClinicLayout section="dentists" title="Dentists & Schedules" requires={['clinic.dentists.manage', 'clinic.schedules.manage']}>
      <Dentists />
    </ClinicLayout>
  );
}

export default ClinicDentistsPage;
