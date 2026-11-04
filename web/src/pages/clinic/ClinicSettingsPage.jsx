import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic, useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { ClinicProfileTabs } from '../../components/clinic/ClinicUi';
import { Badge, Checkbox, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref } from '../../config/clinicNavigation';
import { getPublicClinicHref } from '../../config/navigation';
import {
  getBranches,
  getClinicOverview,
  getSpecializationOptions,
  setClinicPublished,
  updateClinicProfile,
} from '../../services/clinicPortalApi';
import { formatClockTime, WEEKDAY_NAMES } from '../../utils/dateTime';
import { embedUrl, searchUrl } from '../../utils/maps';
import './ClinicSettingsPage.css';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "Monday – Friday 8:00 AM – 5:00 PM": consecutive days with the same hours merged. */
export function groupHours(hours = []) {
  const byDay = Object.fromEntries(hours.map((h) => [h.day_of_week, h]));
  const groups = [];
  WEEK_ORDER.forEach((day) => {
    const entry = byDay[day];
    const text = entry ? `${formatClockTime(entry.opens_at)} – ${formatClockTime(entry.closes_at)}` : null;
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.to = day;
    else groups.push({ from: day, to: day, text });
  });
  return groups.map(({ from, to, text }) => ({
    days: from === to ? WEEKDAY_NAMES[from] : `${WEEKDAY_NAMES[from]} – ${WEEKDAY_NAMES[to]}`,
    text,
  }));
}

function ProfileModal({ clinic, onClose }) {
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      onClose();
    },
  });
  const bind = (name) => ({ value: form[name] ?? '', onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });
  const toggleSpecialization = (id) =>
    setForm((f) => ({
      ...f,
      specialization_ids: f.specialization_ids.includes(id) ? f.specialization_ids.filter((x) => x !== id) : [...f.specialization_ids, id],
    }));

  return (
    <Modal title="Edit clinic profile" onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
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
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
    </Modal>
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

function ContactTile({ icon, label, children }) {
  return (
    <div className="clinic-contact-tile">
      <Icon name={icon} size={20} />
      <div>
        <p className="clinic-contact-label">{label}</p>
        <p className="clinic-contact-value">{children}</p>
      </div>
    </div>
  );
}

function ProfileView({ clinic }) {
  const { clinicId, can } = useClinic();
  const branches = useQuery({ queryKey: ['clinic', clinicId, 'branches'], queryFn: () => getBranches(clinicId) });
  const main = (branches.data ?? []).find((b) => b.is_main) ?? branches.data?.[0];
  const place = { name: clinic.name, address: `${clinic.address}, ${clinic.city}, ${clinic.province}`, latitude: clinic.latitude, longitude: clinic.longitude };
  const mapSrc = embedUrl(place);
  const specialties = (clinic.specializations ?? []).map((s) => s.name);
  const cityProvince = [clinic.city, clinic.province].filter(Boolean).join(', ');

  return (
    <div className="clinic-profile">
      <section className="clinic-profile-hero" aria-labelledby="clinic-profile-name">
        <div className="clinic-profile-banner" />
        <div className="clinic-profile-hero-body">
          <span className="clinic-profile-logo" aria-hidden="true">
            {clinic.name.trim().charAt(0).toUpperCase()}
          </span>
          <h2 id="clinic-profile-name" className="clinic-profile-name">
            {clinic.name}
          </h2>
          <p className="clinic-profile-meta">{[...specialties, cityProvince].filter(Boolean).join(' · ')}</p>
        </div>
      </section>

      <section className="clinic-card-soft">
        <h2 className="clinic-card-soft-title">Clinic Description</h2>
        <p className="clinic-profile-text">{clinic.description || 'No description yet. Use Edit Profile to add one.'}</p>
      </section>

      <section className="clinic-card-soft">
        <h2 className="clinic-card-soft-title">Contact Information</h2>
        <div className="clinic-contact-grid">
          <ContactTile icon="phone" label="Phone">
            {clinic.contact_number || '—'}
          </ContactTile>
          <ContactTile icon="mail" label="Email">
            {clinic.email || '—'}
          </ContactTile>
          <ContactTile icon="mapPin" label="Address">
            {clinic.address || '—'}
          </ContactTile>
          <ContactTile icon="building" label="City">
            {cityProvince || '—'}
          </ContactTile>
        </div>
      </section>

      <section className="clinic-card-soft">
        <div className="clinic-card-soft-head">
          <div>
            <h2 className="clinic-card-soft-title">Operating Hours</h2>
            {main && <p className="clinic-card-soft-sub">{main.name}</p>}
          </div>
          {can('clinic.schedules.manage') && (
            <a href={getClinicHref(clinicId, 'branches')} className="clinic-overview-link">
              Edit hours
            </a>
          )}
        </div>
        {branches.isPending ? (
          <p className="clinic-card-soft-sub">Loading hours…</p>
        ) : branches.isError ? (
          <p className="clinic-card-soft-sub">The hours could not be loaded.</p>
        ) : !main ? (
          <p className="clinic-card-soft-sub">No branch yet.</p>
        ) : (
          <dl className="clinic-hours">
            {groupHours(main.operating_hours).map((row) => (
              <div key={row.days}>
                <dt>{row.days}</dt>
                <dd className={row.text ? 'is-open' : ''}>{row.text ?? 'Closed'}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="clinic-card-soft">
        <h2 className="clinic-card-soft-title">Location</h2>
        <p className="clinic-card-soft-sub">{place.address}</p>
        {mapSrc ? (
          <iframe className="clinic-profile-map" title={`Map of ${clinic.name}`} src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        ) : (
          <a href={searchUrl(place)} target="_blank" rel="noreferrer" className="clinic-profile-map is-placeholder">
            <Icon name="map" size={44} />
            <span className="clinic-profile-map-title">Open in Google Maps</span>
            <span className="clinic-profile-map-sub">{cityProvince}</span>
          </a>
        )}
      </section>

      <Publishing clinic={clinic} />
    </div>
  );
}

function ClinicSettingsPage() {
  const { clinicId, can } = useClinicAccess();
  const [isEditing, setIsEditing] = useState(false);
  const query = useQuery({ queryKey: ['clinic', clinicId, 'overview'], queryFn: () => getClinicOverview(clinicId), enabled: can('clinic.profile.manage') });

  return (
    <ClinicLayout
      section="settings"
      title="Clinic Profile"
      subtitle="Manage your clinic information"
      requires={['clinic.profile.manage']}
      hideSearch
      headerActions={
        <button type="button" className="btn btn-outline clinic-header-button" disabled={!query.data} onClick={() => setIsEditing(true)}>
          <Icon name="pencil" size={18} />
          Edit Profile
        </button>
      }
    >
      <ClinicProfileTabs clinicId={clinicId} can={can} active="settings" />
      <QueryState query={query} loadingLabel="Loading clinic…">
        {(clinic) => (
          <>
            <ProfileView clinic={clinic} />
            {isEditing && <ProfileModal clinic={clinic} onClose={() => setIsEditing(false)} />}
          </>
        )}
      </QueryState>
    </ClinicLayout>
  );
}

export default ClinicSettingsPage;
