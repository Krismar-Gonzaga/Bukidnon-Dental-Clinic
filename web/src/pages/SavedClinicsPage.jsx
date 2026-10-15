import { useState } from 'react';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import SavedClinicCard from '../components/patient/SavedClinicCard';
import {
  PATIENT_FIND_CLINICS_HREF,
  PATIENT_SAVED_CLINICS_HREF,
} from '../config/patientNavigation';
import { findPatientClinic, MOCK_SAVED_CLINIC_IDS } from '../mocks/clinicProfiles';
import { MOCK_DASHBOARD_NOTIFICATIONS, MOCK_PATIENT } from '../mocks/patientDashboard';
import { pluralize } from '../utils/patientDashboard';
import './SavedClinicsPage.css';

// Saved clinics with MOCK data. Removing a clinic only changes this page;
// nothing is saved until a saved-clinics endpoint exists.
function SavedClinicsPage({ initialSavedIds = MOCK_SAVED_CLINIC_IDS }) {
  const [savedIds, setSavedIds] = useState(initialSavedIds);
  const clinics = savedIds.map(findPatientClinic).filter(Boolean);

  const handleUnsave = (clinicId) => {
    setSavedIds((current) => current.filter((id) => id !== clinicId));
  };

  return (
    <PatientLayout
      title="Saved Clinics"
      activeHref={PATIENT_SAVED_CLINICS_HREF}
      user={MOCK_PATIENT}
      hasUnreadNotifications={MOCK_DASHBOARD_NOTIFICATIONS.some(({ unread }) => unread)}
    >
      <div className="saved-clinics">
        <div className="saved-clinics-toolbar">
          <p className="saved-clinics-count" role="status">
            {pluralize(clinics.length, 'saved clinic', 'saved clinics')}
          </p>
          <a href={PATIENT_FIND_CLINICS_HREF} className="saved-clinics-find">
            <Icon name="plus" size={16} />
            Find More Clinics
          </a>
        </div>

        {clinics.length > 0 ? (
          <ul className="saved-clinics-grid">
            {clinics.map((clinic) => (
              <li key={clinic.id}>
                <SavedClinicCard clinic={clinic} onUnsave={handleUnsave} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="saved-clinics-empty">
            You have no saved clinics yet. Use the heart on a clinic's page to save it.
          </p>
        )}
      </div>
    </PatientLayout>
  );
}

export default SavedClinicsPage;
