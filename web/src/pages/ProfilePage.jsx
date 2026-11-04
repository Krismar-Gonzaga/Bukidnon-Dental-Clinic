import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import Tabs from '../components/Tabs';
import ProfileAvatar from '../components/patient/ProfileAvatar';
import { AllergiesPanel, EmergencyPanel, MedicalPanel, OverviewPanel } from '../components/patient/ProfilePanels';
import { QueryState } from '../components/StatusMessage';
import { PROFILE_TABS } from '../config/profile';
import {
  PATIENT_CHANGE_PASSWORD_HREF,
  PATIENT_EDIT_PROFILE_HREF,
  PATIENT_PROFILE_HREF,
} from '../config/patientNavigation';
import { getPatientDashboard, getProfile } from '../services/patientApi';
import { PATIENT_DASHBOARD_KEY } from './PatientDashboardPage';
import { PATIENT_PROFILE_KEY } from './profileKeys';
import { getMedicalAlerts, getProfileChips } from '../utils/profile';
import './ProfilePage.css';

export { PATIENT_PROFILE_KEY };

function ProfilePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const profile = useQuery({ queryKey: PATIENT_PROFILE_KEY, queryFn: getProfile });
  const dashboard = useQuery({ queryKey: PATIENT_DASHBOARD_KEY, queryFn: getPatientDashboard });

  const renderPanel = (data) => {
    if (activeTab === 'medical') return <MedicalPanel health={data.health} />;
    if (activeTab === 'allergies') return <AllergiesPanel health={data.health} />;
    if (activeTab === 'emergency') return <EmergencyPanel profile={data} />;
    return <OverviewPanel profile={data} counts={dashboard.data?.counts} />;
  };

  return (
    <PatientLayout title="My Profile" activeHref={PATIENT_PROFILE_HREF}>
      <QueryState query={profile} loadingLabel="Loading your profile…">
        {(data) => {
          const chips = getProfileChips(data);
          const alerts = getMedicalAlerts(data);
          const place = [data.city, data.province].filter(Boolean).join(', ') || data.address;

          return (
            <div className="profile-page">
              <section className="profile-header" aria-label="Profile summary">
                <ProfileAvatar name={data.name} photoVersion={data.photoVersion} />
                <div className="profile-header-body">
                  <h2 className="profile-header-name">{data.name}</h2>
                  <p className="profile-header-meta">{data.email}</p>
                  <p className="profile-header-meta">{[data.phone, place].filter(Boolean).join(' · ')}</p>
                  {chips.length > 0 && (
                    <ul className="profile-chips" aria-label="Health summary">
                      {chips.map(({ label, tone }) => (
                        <li key={label} className={`profile-chip is-${tone}`}>
                          {label}
                        </li>
                      ))}
                    </ul>
                  )}
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

              {alerts && (
                <section className="profile-alerts" role="note" aria-label="Important medical alerts">
                  <Icon name="alertCircle" size={20} />
                  <div>
                    <p className="profile-alerts-title">Important Medical Alerts</p>
                    <p>{alerts}</p>
                  </div>
                </section>
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
                {renderPanel(data)}
              </div>
            </div>
          );
        }}
      </QueryState>
    </PatientLayout>
  );
}

export default ProfilePage;
