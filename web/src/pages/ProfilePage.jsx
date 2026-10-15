import { useState } from 'react';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import Tabs from '../components/Tabs';
import ProfileInfoCard from '../components/patient/ProfileInfoCard';
import ProfileTag from '../components/patient/ProfileTag';
import ProfileMedicalHistory from '../components/patient/ProfileMedicalHistory';
import ProfileAllergiesMedications from '../components/patient/ProfileAllergiesMedications';
import ProfileEmergencyContact from '../components/patient/ProfileEmergencyContact';
import { PROFILE_TABS } from '../config/profile';
import {
  getEditProfileHref,
  PATIENT_CHANGE_PASSWORD_HREF,
  PATIENT_EDIT_PROFILE_HREF,
  PATIENT_PROFILE_HREF,
} from '../config/patientNavigation';
import { MOCK_APPOINTMENT_HISTORY } from '../mocks/appointmentHistory';
import {
  MOCK_DASHBOARD_NOTIFICATIONS,
  MOCK_DASHBOARD_STATS,
  MOCK_PATIENT,
} from '../mocks/patientDashboard';
import { MOCK_PATIENT_PROFILE } from '../mocks/patientProfile';
import { countAppointmentsByStatus } from '../utils/patientDashboard';
import { formatBirthDate, getAge, getFullName } from '../utils/profile';
import './ProfilePage.css';

// My Profile with MOCK data. Cards on the section tabs link to the matching
// Edit Profile tab.
function ProfilePage({ profile = MOCK_PATIENT_PROFILE, appointments = MOCK_APPOINTMENT_HISTORY }) {
  const [activeTab, setActiveTab] = useState('overview');
  const fullName = getFullName(profile);
  const reviewsGiven = MOCK_DASHBOARD_STATS.find(({ id }) => id === 'reviews')?.value ?? 0;
  const activity = [
    { label: 'Total Appointments', value: appointments.length },
    { label: 'Completed', value: countAppointmentsByStatus(appointments, 'completed') },
    { label: 'Upcoming', value: countAppointmentsByStatus(appointments, 'upcoming') },
    { label: 'Reviews Submitted', value: reviewsGiven },
  ];

  const renderPanel = () => {
    const sectionProps = { profile, editHref: getEditProfileHref(activeTab) };
    if (activeTab === 'medical') return <ProfileMedicalHistory {...sectionProps} />;
    if (activeTab === 'allergies') return <ProfileAllergiesMedications {...sectionProps} />;
    if (activeTab === 'emergency') return <ProfileEmergencyContact {...sectionProps} />;
    return (
      <>
        <div className="profile-overview-grid">
          <ProfileInfoCard
            title="Personal Information"
            subtitle="Basic demographic details"
            rows={[
              { label: 'Full Name', value: fullName },
              { label: 'Date of Birth', value: formatBirthDate(profile.birthDate) },
              { label: 'Age', value: `${getAge(profile.birthDate)} years old` },
              { label: 'Gender', value: profile.gender },
              { label: 'Civil Status', value: profile.civilStatus },
              { label: 'Blood Type', value: profile.bloodType },
            ]}
          />
          <ProfileInfoCard
            title="Contact Details"
            subtitle="How we reach you"
            rows={[
              { label: 'Email', value: profile.email },
              { label: 'Mobile', value: profile.phone },
              { label: 'City', value: profile.city },
              { label: 'Province', value: profile.province },
              { label: 'Zip Code', value: profile.zipCode },
            ]}
          />
        </div>

        <section className="profile-activity" aria-labelledby="profile-activity-title">
          <h2 id="profile-activity-title" className="profile-activity-title">
            Activity Summary
          </h2>
          <dl className="profile-activity-grid">
            {activity.map(({ label, value }) => (
              <div key={label} className="profile-activity-item">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </>
    );
  };

  return (
    <PatientLayout
      title="My Profile"
      activeHref={PATIENT_PROFILE_HREF}
      user={MOCK_PATIENT}
      hasUnreadNotifications={MOCK_DASHBOARD_NOTIFICATIONS.some(({ unread }) => unread)}
    >
      <div className="profile-page">
        <section className="profile-header" aria-label="Profile summary">
          <div className="profile-header-avatar">
            <span aria-hidden="true">{fullName.charAt(0).toUpperCase()}</span>
            <a
              href={PATIENT_EDIT_PROFILE_HREF}
              className="profile-header-photo"
              aria-label="Change profile photo"
            >
              <Icon name="camera" size={14} />
            </a>
          </div>
          <div className="profile-header-body">
            <h2 className="profile-header-name">{fullName}</h2>
            <p className="profile-header-meta">{profile.email}</p>
            <p className="profile-header-meta">
              {profile.phone} · {profile.city}, {profile.province}
            </p>
            <ul className="profile-header-tags" aria-label="Health tags">
              {profile.tags.map(({ label, tone }) => (
                <li key={label}>
                  <ProfileTag tone={tone}>{label}</ProfileTag>
                </li>
              ))}
            </ul>
          </div>
          <div className="profile-header-actions">
            <a href={PATIENT_EDIT_PROFILE_HREF} className="btn btn-primary">
              <Icon name="pencil" size={16} />
              Edit Profile
            </a>
            <a href={PATIENT_CHANGE_PASSWORD_HREF} className="btn profile-password">
              <Icon name="lock" size={16} />
              Password
            </a>
          </div>
        </section>

        {profile.medicalAlert && (
          <div className="profile-alert" role="note">
            <Icon name="alertCircle" size={20} />
            <div>
              <p className="profile-alert-title">Important Medical Alerts</p>
              <p className="profile-alert-text">{profile.medicalAlert}</p>
            </div>
          </div>
        )}

        <Tabs
          tabs={PROFILE_TABS}
          activeId={activeTab}
          onChange={setActiveTab}
          idPrefix="profile"
          label="Profile sections"
          variant="pill"
        />
        <div
          role="tabpanel"
          id={`profile-panel-${activeTab}`}
          aria-labelledby={`profile-tab-${activeTab}`}
          className="profile-panel"
        >
          {renderPanel()}
        </div>
      </div>
    </PatientLayout>
  );
}

export default ProfilePage;
