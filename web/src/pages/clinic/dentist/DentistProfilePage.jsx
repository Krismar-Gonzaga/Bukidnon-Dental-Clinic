import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { Card } from '../../../components/clinic/ClinicAdminUi';
import { InitialsTile, PageTabs, Pill } from '../../../components/clinic/ClinicUi';
import { Field, FormError, Modal } from '../../../components/portal/PortalUi';
import { AccountSecurity } from '../../../components/security/AccountSecurity';
import { QueryState } from '../../../components/StatusMessage';
import { useAuth } from '../../../auth/AuthContext';
import { getClinicHref } from '../../../config/clinicNavigation';
import { fetchCurrentUser } from '../../../services/authService';
import { getDentistProfile, getDentistSchedule, updateDentistProfile } from '../../../services/dentistApi';
import { formatClockTime } from '../../../utils/dateTime';
import { ChangePasswordCard } from '../ClinicAdminSettingsPage';
import { DayButtons } from './DentistSchedulePage';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'license', label: 'License & Credentials' },
  { value: 'availability', label: 'Availability' },
  { value: 'security', label: 'Security' },
];

function Details({ rows }) {
  return (
    <dl className="dentist-details">
      {rows.map(([label, value]) => (
        <div key={label} className="dentist-detail-row">
          <dt>{label}</dt>
          <dd>{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function EditModal({ clinicId, profile, onClose }) {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();
  const [form, setForm] = useState({
    name: profile.name ?? '',
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    website: profile.website ?? '',
    specialization_id: profile.specialization_id ?? '',
    secondary_specialization: profile.secondary_specialization ?? '',
    education: profile.education ?? '',
    years_experience: profile.years_experience ?? '',
    bio: profile.bio ?? '',
  });
  const change = (name) => (event) => setForm((f) => ({ ...f, [name]: event.target.value }));
  const save = useMutation({
    mutationFn: () =>
      updateDentistProfile(clinicId, {
        ...form,
        specialization_id: form.specialization_id || null,
        years_experience: form.years_experience === '' ? null : Number(form.years_experience),
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'dentist', 'profile'] });
      // The name and specialization also show in the sidebar and top bar.
      const fresh = await fetchCurrentUser();
      if (fresh) setUser(fresh);
      onClose();
    },
  });
  return (
    <Modal title="Edit Profile" wide onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="dentist-form-row">
          <Field label="Full Name" required maxLength={255} value={form.name} onChange={change('name')} />
          <Field label="Phone" maxLength={30} value={form.phone} onChange={change('phone')} />
        </div>
        <div className="dentist-form-row">
          <Field label="Address" maxLength={255} value={form.address} onChange={change('address')} />
          <Field label="Website" maxLength={255} value={form.website} onChange={change('website')} />
        </div>
        <div className="dentist-form-row">
          <Field
            label="Specialization"
            as="select"
            value={form.specialization_id}
            onChange={change('specialization_id')}
            options={[{ value: '', label: 'Not set' }, ...(profile.specializations ?? []).map((s) => ({ value: s.id, label: s.name }))]}
          />
          <Field label="Secondary" maxLength={255} value={form.secondary_specialization} onChange={change('secondary_specialization')} />
        </div>
        <div className="dentist-form-row">
          <Field label="Education" maxLength={255} value={form.education} onChange={change('education')} />
          <Field label="Years of Experience" type="number" min={0} max={70} value={form.years_experience} onChange={change('years_experience')} />
        </div>
        <Field label="Biography" as="textarea" rows={4} maxLength={2000} value={form.bio} onChange={change('bio')} />
        <p className="clinic-file-meta">Your sign-in email and licence numbers are changed through your clinic administrator.</p>
        <FormError error={save.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!form.name.trim() || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProfileTab({ profile }) {
  return (
    <div className="dentist-columns" style={{ maxWidth: 900 }}>
      <Card title="Personal Information">
        <Details
          rows={[
            ['Full Name', profile.name],
            ['Email', profile.email],
            ['Phone', profile.phone],
            ['Address', profile.address],
            ['Website', profile.website],
          ]}
        />
      </Card>
      <Card title="Professional Details">
        <Details
          rows={[
            ['Specialization', profile.specialization],
            ['Secondary', profile.secondary_specialization],
            ['Education', profile.education],
            ['Experience', profile.years_experience != null ? `${profile.years_experience} years` : null],
          ]}
        />
        <p className="dentist-info-label clinic-form-gap">Biography</p>
        <p className="clinic-admin-card-sub">{profile.bio || 'No biography yet.'}</p>
      </Card>
    </div>
  );
}

function Credential({ icon, label, value, status }) {
  return (
    <div className="dentist-credential">
      <span className="dentist-list-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <div className="dentist-credential-body">
        <p className="dentist-info-label">{label}</p>
        <p className="dentist-info-value" style={{ fontWeight: 600 }}>{value || 'Not on file'}</p>
      </div>
      {value ? <Pill tone="success">{status}</Pill> : <Pill tone="neutral">Missing</Pill>}
    </div>
  );
}

function LicenseTab({ profile }) {
  return (
    <div className="dentist-narrower">
      <Card title="License & Professional Credentials">
        <Credential icon="shield" label="PRC License Number" value={profile.license_number} status="On file" />
        <Credential icon="fileText" label="PTR Number" value={profile.ptr_number} status="On file" />
        <Credential icon="award" label="S2 Number" value={profile.s2_number} status="On file" />
        <p className="dentist-info-note">
          <Icon name="info" size={16} />
          License and credential updates require clinic administrator verification. Contact your admin to update these details.
        </p>
      </Card>
    </div>
  );
}

function AvailabilityTab({ clinicId }) {
  const query = useQuery({ queryKey: ['clinic', clinicId, 'dentist', 'schedule'], queryFn: () => getDentistSchedule(clinicId) });
  return (
    <div className="dentist-narrower">
      <Card title="Working Schedule">
        <QueryState query={query} loadingLabel="Loading your schedule…">
          {(schedule) => (
            <>
              <DayButtons days={schedule.days} />
              <div className="dentist-time-pair">
                <div className="dentist-info">
                  <div>
                    <p className="dentist-info-label">Start Time</p>
                    <p className="dentist-info-value">{schedule.starts_at ? formatClockTime(schedule.starts_at) : 'Not set'}</p>
                  </div>
                </div>
                <div className="dentist-info">
                  <div>
                    <p className="dentist-info-label">End Time</p>
                    <p className="dentist-info-value">{schedule.ends_at ? formatClockTime(schedule.ends_at) : 'Not set'}</p>
                  </div>
                </div>
              </div>
              {schedule.pending_change && (
                <p className="dentist-info-note clinic-form-gap">
                  <Icon name="clock" size={16} />
                  A change to these hours is waiting for your clinic administrator&apos;s approval.
                </p>
              )}
              <div className="dentist-actions-row">
                <a href={getClinicHref(clinicId, 'my-schedule')} className="btn btn-primary">
                  <Icon name="clock" size={18} />
                  Manage Full Schedule
                </a>
              </div>
            </>
          )}
        </QueryState>
      </Card>
    </div>
  );
}

/** My Profile: professional details, credentials, availability and account security. */
function DentistProfilePage() {
  const { clinicId } = useClinicAccess();
  const [tab, setTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const query = useQuery({ queryKey: ['clinic', clinicId, 'dentist', 'profile'], queryFn: () => getDentistProfile(clinicId) });

  return (
    <ClinicLayout
      section="profile"
      title="My Profile"
      subtitle="Manage your professional information"
      hideSearch
      headerActions={
        tab === 'profile' &&
        query.data && (
          <button type="button" className="btn btn-primary clinic-header-button" onClick={() => setIsEditing(true)}>
            <Icon name="pencil" size={18} />
            Edit Profile
          </button>
        )
      }
    >
      <QueryState query={query} loadingLabel="Loading your profile…">
        {(profile) => (
          <>
            <Card>
              <div className="dentist-profile-head">
                <InitialsTile name={profile.name} size="lg" tone="navy" />
                <div className="dentist-profile-main">
                  <h2 className="dentist-profile-name">{profile.name}</h2>
                  <p className="dentist-row-sub">{[profile.specialization, profile.secondary_specialization].filter(Boolean).join(' · ') || 'Dentist'}</p>
                  <p className="dentist-row-sub">{profile.clinic_name}</p>
                  <p className="dentist-name-line" style={{ marginTop: 'var(--space-1)' }}>
                    <Pill tone={profile.status === 'active' ? 'success' : 'neutral'}>{profile.status === 'active' ? 'Active' : 'Inactive'}</Pill>
                    {profile.years_experience != null && <Pill tone="info">{profile.years_experience} years experience</Pill>}
                  </p>
                </div>
              </div>
            </Card>
            <div className="clinic-form-gap">
              <PageTabs label="Profile sections" value={tab} onChange={setTab} tabs={TABS} />
            </div>
            <div className="clinic-form-gap">
              {tab === 'profile' && <ProfileTab profile={profile} />}
              {tab === 'license' && <LicenseTab profile={profile} />}
              {tab === 'availability' && <AvailabilityTab clinicId={clinicId} />}
              {tab === 'security' && (
                <div className="dentist-narrower frontdesk-page">
                  <ChangePasswordCard />
                  <AccountSecurity />
                </div>
              )}
            </div>
            {isEditing && <EditModal clinicId={clinicId} profile={profile} onClose={() => setIsEditing(false)} />}
          </>
        )}
      </QueryState>
    </ClinicLayout>
  );
}

export default DentistProfilePage;
