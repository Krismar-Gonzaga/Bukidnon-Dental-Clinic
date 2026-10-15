import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import Tabs from '../components/Tabs';
import ProfileField from '../components/patient/ProfileField';
import SuccessCard from '../components/patient/SuccessCard';
import { QueryState } from '../components/StatusMessage';
import {
  GENDER_OPTIONS,
  PROFILE_UPDATED_MESSAGE,
  PROFILE_UPDATED_TITLE,
} from '../config/profile';
import { PATIENT_PROFILE_HREF } from '../config/patientNavigation';
import { getProfile, updateProfile } from '../services/patientApi';
import { updateNotificationPreferences } from '../services/notificationApi';
import { getErrorMessage, getFieldErrors } from '../services/apiErrors';
import { CURRENT_USER_KEY } from '../auth/AuthContext';
import { PATIENT_PROFILE_KEY } from './ProfilePage';
import '../components/patient/patientPanel.css';
import './EditProfilePage.css';

const EDIT_TABS = [
  { id: 'overview', label: 'Personal' },
  { id: 'emergency', label: 'Emergency Contact' },
  { id: 'notifications', label: 'Notifications' },
];

// Backend field → form field, for showing validation errors.
const FIELD_NAMES = {
  name: 'name',
  email: 'email',
  phone: 'phone',
  address: 'address',
  birth_date: 'birthDate',
  gender: 'gender',
  emergency_contact_name: 'emergencyContactName',
  emergency_contact_phone: 'emergencyContactPhone',
};

function EditProfileForm({ profile, initialTab }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(() =>
    EDIT_TABS.some(({ id }) => id === initialTab) ? initialTab : 'overview'
  );
  const [form, setForm] = useState(profile);
  const successRef = useRef(null);

  const save = useMutation({
    mutationFn: async () => {
      await updateProfile(form);
      if (form.emailNotifications !== profile.emailNotifications) {
        await updateNotificationPreferences({ email: form.emailNotifications });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PATIENT_PROFILE_KEY });
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
    },
  });

  useEffect(() => {
    if (save.isSuccess) successRef.current?.focus();
  }, [save.isSuccess]);

  const fieldErrors = Object.fromEntries(
    Object.entries(save.isError ? getFieldErrors(save.error) : {}).map(([key, message]) => [FIELD_NAMES[key] ?? key, message])
  );

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const field = (name) => ({
    id: `profile-${name}`,
    name,
    value: form[name] ?? '',
    onChange: handleChange,
    'aria-invalid': fieldErrors[name] ? true : undefined,
  });

  if (save.isSuccess) {
    return (
      <SuccessCard
        ref={successRef}
        title={PROFILE_UPDATED_TITLE}
        message={PROFILE_UPDATED_MESSAGE}
        action={
          <a href={PATIENT_PROFILE_HREF} className="btn btn-primary">
            Back to Profile
          </a>
        }
      />
    );
  }

  return (
    <form
      className="patient-panel edit-profile-card"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <Tabs
        tabs={EDIT_TABS}
        activeId={activeTab}
        onChange={setActiveTab}
        idPrefix="edit-profile"
        label="Profile sections"
        variant="pill"
      />

      <div
        role="tabpanel"
        id={`edit-profile-panel-${activeTab}`}
        aria-labelledby={`edit-profile-tab-${activeTab}`}
        className="edit-profile-panel"
      >
        {activeTab === 'overview' && (
          <div className="edit-profile-grid">
            <ProfileField label="Full Name" required className="is-wide" {...field('name')} />
            <ProfileField label="Email Address" type="email" icon="mail" required className="is-wide" {...field('email')} />
            <ProfileField label="Phone Number" type="tel" icon="phone" className="is-wide" {...field('phone')} />
            <ProfileField label="Date of Birth" type="date" {...field('birthDate')} />
            <ProfileField label="Gender" options={GENDER_OPTIONS} {...field('gender')} />
            <ProfileField label="Address" icon="mapPin" className="is-wide" {...field('address')} />
          </div>
        )}
        {activeTab === 'emergency' && (
          <div className="edit-profile-grid">
            <ProfileField label="Contact Name" className="is-wide" {...field('emergencyContactName')} />
            <ProfileField label="Contact Phone" type="tel" icon="phone" className="is-wide" {...field('emergencyContactPhone')} />
          </div>
        )}
        {activeTab === 'notifications' && (
          <label className="edit-profile-toggle">
            <input
              type="checkbox"
              name="emailNotifications"
              checked={form.emailNotifications}
              onChange={handleChange}
            />
            <span>
              Email me about appointment updates and reminders. In-app notifications are always on.
            </span>
          </label>
        )}
      </div>

      {save.isError && (
        <div className="edit-profile-error" role="alert">
          <p>{Object.keys(fieldErrors).length > 0 ? 'Please check these fields:' : getErrorMessage(save.error)}</p>
          {Object.keys(fieldErrors).length > 0 && (
            <ul>
              {Object.values(fieldErrors).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="edit-profile-actions">
        <a href={PATIENT_PROFILE_HREF} className="btn btn-lg edit-profile-cancel">
          Cancel
        </a>
        <button type="submit" className="btn btn-primary btn-lg" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

function EditProfilePage() {
  const [searchParams] = useSearchParams();
  const profile = useQuery({ queryKey: PATIENT_PROFILE_KEY, queryFn: getProfile });

  return (
    <PatientLayout title="Edit Profile" activeHref={PATIENT_PROFILE_HREF}>
      <div className="edit-profile-page">
        <a href={PATIENT_PROFILE_HREF} className="patient-back-link">
          <Icon name="chevronLeft" size={16} />
          Back to Profile
        </a>
        <QueryState query={profile} loadingLabel="Loading your profile…">
          {(data) => <EditProfileForm profile={data} initialTab={searchParams.get('tab')} />}
        </QueryState>
      </div>
    </PatientLayout>
  );
}

export default EditProfilePage;
