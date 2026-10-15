import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import { Badge, Checkbox, Field, FormError, Section } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { getPublicClinicHref } from '../../config/navigation';
import {
  getClinicOverview,
  getSpecializationOptions,
  setClinicPublished,
  updateClinicProfile,
} from '../../services/clinicPortalApi';

function ProfileForm({ clinic }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const specializations = useQuery({ queryKey: ['specializations'], queryFn: getSpecializationOptions, staleTime: 10 * 60 * 1000 });
  const [form, setForm] = useState({
    name: clinic.name,
    description: clinic.description ?? '',
    address: clinic.address,
    city: clinic.city,
    province: clinic.province,
    contact_number: clinic.contact_number ?? '',
    email: clinic.email ?? '',
    latitude: clinic.latitude ?? '',
    longitude: clinic.longitude ?? '',
    specialization_ids: (clinic.specializations ?? []).map((s) => s.id),
  });
  const save = useMutation({
    mutationFn: () =>
      updateClinicProfile(clinicId, {
        ...form,
        latitude: form.latitude === '' ? null : Number(form.latitude),
        longitude: form.longitude === '' ? null : Number(form.longitude),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] }),
  });
  const bind = (name) => ({ value: form[name] ?? '', onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });
  const toggleSpecialization = (id) =>
    setForm((f) => ({
      ...f,
      specialization_ids: f.specialization_ids.includes(id) ? f.specialization_ids.filter((x) => x !== id) : [...f.specialization_ids, id],
    }));

  return (
    <Section title="Clinic profile" subtitle="Shown on your public clinic page.">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="portal-form-grid">
          <Field label="Clinic name" required className="is-wide" {...bind('name')} />
          <Field label="Description" as="textarea" className="is-wide" {...bind('description')} />
          <Field label="Street address" required className="is-wide" {...bind('address')} />
          <Field label="City / municipality" required {...bind('city')} />
          <Field label="Province" required {...bind('province')} />
          <Field label="Contact number" type="tel" required {...bind('contact_number')} />
          <Field label="Email" type="email" {...bind('email')} />
          <Field label="Latitude" type="number" step="any" hint="Places your clinic on the map." {...bind('latitude')} />
          <Field label="Longitude" type="number" step="any" {...bind('longitude')} />
          <fieldset className="is-wide portal-field">
            <legend className="portal-field-label">Specializations</legend>
            <div className="portal-actions">
              {(specializations.data ?? []).map((s) => (
                <Checkbox key={s.id} label={s.name} checked={form.specialization_ids.includes(s.id)} onChange={() => toggleSpecialization(s.id)} />
              ))}
            </div>
          </fieldset>
        </div>
        <FormError error={save.error} />
        {save.isSuccess && <p className="portal-success portal-spaced-top" role="status">Profile saved.</p>}
        <div className="portal-form-actions">
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>Save profile</button>
        </div>
      </form>
    </Section>
  );
}

function Publishing({ clinic }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const publish = useMutation({
    mutationFn: (value) => setClinicPublished(clinicId, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] }),
  });

  return (
    <Section
      title="Directory listing"
      actions={<Badge status={clinic.status}>{clinic.status}</Badge>}
      subtitle={
        clinic.status === 'suspended'
          ? 'This clinic is suspended by the platform administrators and is hidden from patients.'
          : clinic.is_published
            ? 'Your clinic is listed and patients can book online.'
            : 'Your clinic is hidden. Add services, dentist schedules and opening hours, then publish.'
      }
    >
      <div className="portal-actions">
        {clinic.status === 'approved' && (
          <button
            type="button"
            className={`btn btn-sm ${clinic.is_published ? 'btn-outline' : 'btn-primary'}`}
            disabled={publish.isPending}
            onClick={() => publish.mutate(!clinic.is_published)}
          >
            {clinic.is_published ? 'Hide from directory' : 'Publish clinic'}
          </button>
        )}
        {clinic.is_published && (
          <a className="btn btn-outline btn-sm" href={getPublicClinicHref(clinicId)} target="_blank" rel="noreferrer">
            View public page
          </a>
        )}
      </div>
      <FormError error={publish.error} />
    </Section>
  );
}

function Settings() {
  const { clinicId } = useClinic();
  const query = useQuery({ queryKey: ['clinic', clinicId, 'overview'], queryFn: () => getClinicOverview(clinicId) });

  return (
    <QueryState query={query} loadingLabel="Loading clinic…">
      {(clinic) => (
        <div className="portal-stack">
          <Publishing clinic={clinic} />
          <ProfileForm clinic={clinic} />
        </div>
      )}
    </QueryState>
  );
}

function ClinicSettingsPage() {
  return (
    <ClinicLayout section="settings" title="Clinic Profile" requires={['clinic.profile.manage']}>
      <Settings />
    </ClinicLayout>
  );
}

export default ClinicSettingsPage;
