import { useState } from 'react';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import Tabs from '../components/Tabs';
import ProfileInfoCard from '../components/patient/ProfileInfoCard';
import { PROFILE_TABS } from '../config/profile';
import { PATIENT_EDIT_PROFILE_HREF, PATIENT_PROFILE_HREF } from '../config/patientNavigation';
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

const listRows = (label, items) => items.map((item) => ({ label, value: item }));

// My Profile with MOCK data. Only the Overview tab is designed; the other tabs
// list what the medical alert already says. Password is not connected yet.
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
    if (activeTab === 'medical') {
      return (
        <ProfileInfoCard
          title="Medical History"
          subtitle="Conditions your dentist should know about"
          rows={listRows('Condition', profile.conditions)}
        >
          <p className="profile-empty">No medical conditions recorded.</p>
        </ProfileInfoCard>
      );
    }
    if (activeTab === 'allergies') {
      return (
        <ProfileInfoCard
          title="Allergies & Medications"
          subtitle="Share these before any procedure"
          rows={[
            ...listRows('Allergy', profile.allergies),
            ...listRows('Medication', profile.medications),
          ]}
        >
          <p className="profile-empty">No allergies or medications recorded.</p>
        </ProfileInfoCard>
      );
    }
    if (activeTab === 'emergency') {
      const contact = profile.emergencyContact;
      return (
        <ProfileInfoCard
          title="Emergency Contact"
          subtitle="Who we call if something happens"
          rows={
            contact
              ? [
                  { label: 'Name', value: contact.name },
                  { label: 'Relationship', value: contact.relationship },
                  { label: 'Phone', value: contact.phone },
                ]
              : []
          }
        >
          <p className="profile-empty">No emergency contact added yet.</p>
        </ProfileInfoCard>
      );
    }
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
                <li key={label} className={`profile-tag profile-tag--${tone}`}>
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="profile-header-actions">
            <a href={PATIENT_EDIT_PROFILE_HREF} className="btn btn-primary">
              <Icon name="pencil" size={16} />
              Edit Profile
            </a>
            {/* Change password is not connected until its design and the API exist. */}
            <button type="button" className="btn profile-password">
              <Icon name="lock" size={16} />
              Password
            </button>
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
