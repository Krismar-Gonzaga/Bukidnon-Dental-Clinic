import { useEffect, useRef, useState } from 'react';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import Tabs from '../components/Tabs';
import ProfileField from '../components/patient/ProfileField';
import SuccessCard from '../components/patient/SuccessCard';
import {
  BLOOD_TYPE_OPTIONS,
  CIVIL_STATUS_OPTIONS,
  GENDER_OPTIONS,
  PROFILE_TABS,
  PROFILE_UPDATED_MESSAGE,
  PROFILE_UPDATED_TITLE,
} from '../config/profile';
import { PATIENT_PROFILE_HREF } from '../config/patientNavigation';
import { MOCK_DASHBOARD_NOTIFICATIONS, MOCK_PATIENT } from '../mocks/patientDashboard';
import { MOCK_PATIENT_PROFILE } from '../mocks/patientProfile';
import { getFullName } from '../utils/profile';
import '../components/patient/patientPanel.css';
import './EditProfilePage.css';

const EDIT_TABS = PROFILE_TABS.map(({ id, editLabel }) => ({ id, label: editLabel }));

const PERSONAL_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'birthDate',
  'gender',
  'civilStatus',
  'bloodType',
  'city',
  'province',
];

const pickPersonal = (profile) =>
  Object.fromEntries(PERSONAL_FIELDS.map((field) => [field, profile[field] ?? '']));

// ?tab=<id> (from the My Profile Edit links) opens that section's tab.
const getTabFromQuery = () => new URLSearchParams(window.location.search).get('tab');

// Edit Profile with MOCK data. Only the Personal tab is designed. Save shows
// the success screen but keeps nothing; photo upload is not connected yet.
function EditProfilePage({ profile = MOCK_PATIENT_PROFILE, initialTab = getTabFromQuery() }) {
  const [activeTab, setActiveTab] = useState(() =>
    EDIT_TABS.some(({ id }) => id === initialTab) ? initialTab : 'overview'
  );
  const [form, setForm] = useState(() => pickPersonal(profile));
  const [isSaved, setIsSaved] = useState(false);
  const successRef = useRef(null);

  useEffect(() => {
    if (isSaved) successRef.current?.focus();
  }, [isSaved]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    // MOCK save: replace with PUT /patient/profile during integration.
    setIsSaved(true);
  };

  const field = (name) => ({
    id: `profile-${name}`,
    name,
    value: form[name],
    onChange: handleChange,
  });

  return (
    <PatientLayout
      title="Edit Profile"
      activeHref={PATIENT_PROFILE_HREF}
      user={MOCK_PATIENT}
      hasUnreadNotifications={MOCK_DASHBOARD_NOTIFICATIONS.some(({ unread }) => unread)}
    >
      <div className="edit-profile-page">
        <a href={PATIENT_PROFILE_HREF} className="patient-back-link">
          <Icon name="chevronLeft" size={16} />
          Back to Profile
        </a>

        {isSaved ? (
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
        ) : (
          <form className="patient-panel edit-profile-card" onSubmit={handleSubmit}>
            <div className="edit-profile-photo">
              <span className="edit-profile-avatar" aria-hidden="true">
                {getFullName(form).charAt(0).toUpperCase() || '?'}
              </span>
              <div>
                <p className="edit-profile-photo-title">Profile Photo</p>
                {/* Photo upload is not connected until file storage exists. */}
                <button type="button" className="edit-profile-upload">
                  <Icon name="camera" size={16} />
                  Upload new photo
                </button>
              </div>
            </div>
  
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
              {activeTab === 'overview' ? (
                <div className="edit-profile-grid">
                  <ProfileField label="First Name" required {...field('firstName')} />
                  <ProfileField label="Last Name" required {...field('lastName')} />
                  <ProfileField
                    label="Email Address"
                    type="email"
                    icon="mail"
                    required
                    className="is-wide"
                    {...field('email')}
                  />
                  <ProfileField
                    label="Phone Number"
                    type="tel"
                    icon="phone"
                    className="is-wide"
                    {...field('phone')}
                  />
                  <ProfileField label="Date of Birth" type="date" {...field('birthDate')} />
                  <ProfileField label="Gender" options={GENDER_OPTIONS} {...field('gender')} />
                  <ProfileField
                    label="Civil Status"
                    options={CIVIL_STATUS_OPTIONS}
                    {...field('civilStatus')}
                  />
                  <ProfileField
                    label="Blood Type"
                    options={BLOOD_TYPE_OPTIONS}
                    {...field('bloodType')}
                  />
                  <ProfileField
                    label="City / Municipality"
                    icon="mapPin"
                    className="is-wide"
                    {...field('city')}
                  />
                  <ProfileField label="Province" className="is-wide" {...field('province')} />
                </div>
              ) : (
                <p className="edit-profile-pending">
                  Editing this section is not available yet.
                </p>
              )}
            </div>
  
            <div className="edit-profile-actions">
              <a href={PATIENT_PROFILE_HREF} className="btn btn-lg edit-profile-cancel">
                Cancel
              </a>
              <button type="submit" className="btn btn-primary btn-lg">
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>
    </PatientLayout>
  );
}

export default EditProfilePage;
