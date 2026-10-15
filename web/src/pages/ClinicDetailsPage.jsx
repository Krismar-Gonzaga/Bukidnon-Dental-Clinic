import { useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import Icon from '../components/Icon';
import StarRating from '../components/StarRating';
import Tabs from '../components/Tabs';
import ClinicOverview from '../components/clinics/ClinicOverview';
import DentistDirectoryCard from '../components/dentists/DentistDirectoryCard';
import ServiceCard from '../components/services/ServiceCard';
import {
  getBookClinicHref,
  PATIENT_FIND_CLINICS_HREF,
} from '../config/patientNavigation';
import { findPatientClinic, MOCK_SAVED_CLINIC_IDS } from '../mocks/clinicProfiles';
import { DIRECTORY_CLINICS } from '../mocks/directoryClinics';
import { DIRECTORY_DENTISTS } from '../mocks/directoryDentists';
import { MOCK_PATIENT_ACCOUNT } from '../mocks/patientDashboard';
import { SERVICES } from '../mocks/services';
import { withClinicNames } from '../utils/dentistDirectory';
import './ClinicDetailsPage.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'dentists', label: 'Dentists' },
  { id: 'services', label: 'Services' },
  { id: 'reviews', label: 'Reviews' },
];

// A clinic's page as seen by a signed-in patient, with MOCK data. Only the
// Overview tab is designed; Dentists and Services reuse the directory cards,
// and Reviews waits for review data. Saving only changes this page.
function ClinicDetailsPage({ clinicId }) {
  const clinic = findPatientClinic(clinicId);
  const [isSaved, setIsSaved] = useState(MOCK_SAVED_CLINIC_IDS.includes(clinicId));
  const [activeTab, setActiveTab] = useState('overview');

  if (!clinic) {
    return (
      <div className="clinic-details-page">
        <SiteHeader activeHref="/clinics" account={MOCK_PATIENT_ACCOUNT} />
        <main className="clinic-details-container clinic-details-missing">
          <h1 className="clinic-details-missing-title">This clinic could not be found.</h1>
          <a href={PATIENT_FIND_CLINICS_HREF}>Back to Find Clinics</a>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const {
    name,
    address,
    rating,
    reviewCount,
    specializations,
    verified,
    accent,
  } = clinic;
  const bookHref = getBookClinicHref(clinic.id);
  const clinicDentists = withClinicNames(
    DIRECTORY_DENTISTS.filter((dentist) => dentist.clinicId === clinic.id),
    DIRECTORY_CLINICS
  );

  const renderPanel = () => {
    if (activeTab === 'overview') return <ClinicOverview clinic={clinic} bookHref={bookHref} />;
    if (activeTab === 'dentists') {
      return clinicDentists.length > 0 ? (
        <ul className="clinic-details-grid">
          {clinicDentists.map((dentist, index) => (
            <li key={dentist.id}>
              <DentistDirectoryCard dentist={dentist} accentIndex={index} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="clinic-details-empty">No dentists are listed for this clinic yet.</p>
      );
    }
    if (activeTab === 'services') {
      return (
        <ul className="clinic-details-grid">
          {SERVICES.map((service) => (
            <li key={service.id}>
              <ServiceCard service={service} />
            </li>
          ))}
        </ul>
      );
    }
    return <p className="clinic-details-empty">No reviews to show yet.</p>;
  };

  return (
    <div className="clinic-details-page">
      <SiteHeader activeHref="/clinics" account={MOCK_PATIENT_ACCOUNT} />

      <main>
        <section className={`clinic-details-hero clinic-details-hero--accent-${accent}`}>
          <Icon name="building" size={120} className="clinic-details-hero-icon" />
          <div className="clinic-details-container">
            <ul className="clinic-details-tags" aria-label="Clinic tags">
              {verified && (
                <li className="clinic-details-tag clinic-details-tag--verified">
                  <Icon name="shieldCheck" size={13} />
                  Verified
                </li>
              )}
              {specializations.map((specialization) => (
                <li key={specialization} className="clinic-details-tag">
                  {specialization}
                </li>
              ))}
            </ul>
            <h1 className="clinic-details-name">{name}</h1>
            <p className="clinic-details-address">
              <Icon name="mapPin" size={16} />
              {address}
            </p>
          </div>
        </section>

        <div className="clinic-details-container clinic-details-body">
          <div className="clinic-details-bar">
            <p className="clinic-details-rating">
              <StarRating rating={rating} size={16} />
              <span>
                {rating.toFixed(1)} ({reviewCount} reviews)
              </span>
            </p>
            <div className="clinic-details-actions">
              <button
                type="button"
                className={`clinic-details-save${isSaved ? ' is-saved' : ''}`}
                aria-pressed={isSaved}
                aria-label={isSaved ? `Remove ${name} from saved clinics` : `Save ${name}`}
                onClick={() => setIsSaved((saved) => !saved)}
              >
                <Icon name="heart" size={20} />
              </button>
              <a href={bookHref} className="btn btn-primary">
                Book Appointment
              </a>
            </div>
          </div>

          <Tabs
            tabs={TABS}
            activeId={activeTab}
            onChange={setActiveTab}
            idPrefix="clinic"
            label="Clinic sections"
          />
          <div
            role="tabpanel"
            id={`clinic-panel-${activeTab}`}
            aria-labelledby={`clinic-tab-${activeTab}`}
            className="clinic-details-panel"
          >
            {renderPanel()}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export default ClinicDetailsPage;
