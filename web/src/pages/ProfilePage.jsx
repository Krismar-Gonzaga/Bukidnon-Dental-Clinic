import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import Tabs from '../components/Tabs';
import ProfileInfoCard from '../components/patient/ProfileInfoCard';
import { EmptyState, QueryState } from '../components/StatusMessage';
import { PROFILE_TABS } from '../config/profile';
import {
  getEditProfileHref,
  PATIENT_CHANGE_PASSWORD_HREF,
  PATIENT_EDIT_PROFILE_HREF,
  PATIENT_PROFILE_HREF,
} from '../config/patientNavigation';
import {
  getMedicalHistory,
  getPatientDashboard,
  getProfile,
  getSharedRecords,
} from '../services/patientApi';
import { PATIENT_DASHBOARD_KEY } from './PatientDashboardPage';
import { formatBirthDate, getAge } from '../utils/profile';
import './ProfilePage.css';

export const PATIENT_PROFILE_KEY = ['patient', 'profile'];

const orDash = (value) => value || '—';

const CLINIC_RECORDED_NOTE =
  'Recorded by your clinic during visits. To correct something, tell your dentist at your next appointment.';

function MedicalPanel() {
  const history = useQuery({ queryKey: ['patient', 'medicalHistory'], queryFn: getMedicalHistory });
  const records = useQuery({ queryKey: ['patient', 'records'], queryFn: getSharedRecords });

  return (
    <div className="profile-overview-grid">
      <ProfileInfoCard title="Medical Conditions" subtitle={CLINIC_RECORDED_NOTE}>
        <QueryState query={history} loadingLabel="Loading…">
          {(entries) =>
            entries.some((e) => e.conditions) ? (
              <dl className="profile-info-card-rows">
                {entries.filter((e) => e.conditions).map((entry) => (
                  <div key={entry.clinic} className="profile-info-card-row">
                    <dt>{entry.clinic} · {entry.recordedAt}</dt>
                    <dd>{entry.conditions}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="profile-empty-text">No conditions recorded.</p>
            )
          }
        </QueryState>
      </ProfileInfoCard>
      <ProfileInfoCard title="Treatments & Care Instructions" subtitle="Shared with you by your clinics">
        <QueryState query={records} loadingLabel="Loading…">
          {(items) =>
            items.length > 0 ? (
              <ul className="profile-record-list">
                {items.map((record) => (
                  <li key={record.id} className="profile-record">
                    <p className="profile-record-title">
                      {record.procedures || record.type} · {record.date}
                    </p>
                    <p className="profile-record-meta">
                      {record.clinic}
                      {record.dentist && ` · ${record.dentist}`}
                    </p>
                    {record.careInstructions && <p className="profile-record-text">{record.careInstructions}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="profile-empty-text">No shared treatment notes yet.</p>
            )
          }
        </QueryState>
      </ProfileInfoCard>
    </div>
  );
}

function AllergiesPanel() {
  const history = useQuery({ queryKey: ['patient', 'medicalHistory'], queryFn: getMedicalHistory });

  return (
    <QueryState query={history} loadingLabel="Loading…">
      {(entries) =>
        entries.length === 0 ? (
          <EmptyState icon="shield" title="Nothing recorded yet">
            {CLINIC_RECORDED_NOTE}
          </EmptyState>
        ) : (
          <div className="profile-overview-grid">
            {entries.map((entry) => (
              <ProfileInfoCard
                key={entry.clinic}
                title={entry.clinic}
                subtitle={`Last updated ${entry.recordedAt}`}
                rows={[
                  { label: 'Allergies', value: orDash(entry.allergies) },
                  { label: 'Medications', value: orDash(entry.medications) },
                ]}
              />
            ))}
          </div>
        )
      }
    </QueryState>
  );
}

function ProfilePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const profile = useQuery({ queryKey: PATIENT_PROFILE_KEY, queryFn: getProfile });
  const dashboard = useQuery({ queryKey: PATIENT_DASHBOARD_KEY, queryFn: getPatientDashboard });
  const counts = dashboard.data?.counts;

  return (
    <PatientLayout title="My Profile" activeHref={PATIENT_PROFILE_HREF}>
      <QueryState query={profile} loadingLabel="Loading your profile…">
        {(data) => {
          const renderPanel = () => {
            if (activeTab === 'medical') return <MedicalPanel />;
            if (activeTab === 'allergies') return <AllergiesPanel />;
            if (activeTab === 'emergency') {
              return (
                <ProfileInfoCard
                  title="Emergency Contact"
                  subtitle="Who the clinic may contact in an emergency"
                  editHref={getEditProfileHref('emergency')}
                  rows={[
                    { label: 'Name', value: orDash(data.emergencyContactName) },
                    { label: 'Phone', value: orDash(data.emergencyContactPhone) },
                  ]}
                />
              );
            }
            return (
              <>
                <div className="profile-overview-grid">
                  <ProfileInfoCard
                    title="Personal Information"
                    subtitle="Basic demographic details"
                    editHref={getEditProfileHref('overview')}
                    rows={[
                      { label: 'Full Name', value: data.name },
                      { label: 'Date of Birth', value: data.birthDate ? formatBirthDate(data.birthDate) : '—' },
                      { label: 'Age', value: data.birthDate ? `${getAge(data.birthDate)} years old` : '—' },
                      { label: 'Gender', value: orDash(data.gender) },
                    ]}
                  />
                  <ProfileInfoCard
                    title="Contact Details"
                    subtitle="How clinics reach you"
                    rows={[
                      { label: 'Email', value: data.email },
                      { label: 'Mobile', value: orDash(data.phone) },
                      { label: 'Address', value: orDash(data.address) },
                      { label: 'Email notifications', value: data.emailNotifications ? 'On' : 'Off' },
                    ]}
                  />
                </div>

                {counts && (
                  <section className="profile-activity" aria-labelledby="profile-activity-title">
                    <h2 id="profile-activity-title" className="profile-activity-title">
                      Activity Summary
                    </h2>
                    <dl className="profile-activity-grid">
                      {[
                        { label: 'Upcoming', value: counts.upcoming },
                        { label: 'Completed', value: counts.completed },
                        { label: 'Saved Clinics', value: counts.saved_clinics },
                        { label: 'Reviews Submitted', value: counts.reviews_given },
                      ].map(({ label, value }) => (
                        <div key={label} className="profile-activity-item">
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
              </>
            );
          };

          return (
            <div className="profile-page">
              <section className="profile-header" aria-label="Profile summary">
                <div className="profile-header-avatar">
                  <span aria-hidden="true">{data.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="profile-header-body">
                  <h2 className="profile-header-name">{data.name}</h2>
                  <p className="profile-header-meta">{data.email}</p>
                  <p className="profile-header-meta">
                    {[data.phone, data.address].filter(Boolean).join(' · ')}
                  </p>
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
          );
        }}
      </QueryState>
    </PatientLayout>
  );
}

export default ProfilePage;
