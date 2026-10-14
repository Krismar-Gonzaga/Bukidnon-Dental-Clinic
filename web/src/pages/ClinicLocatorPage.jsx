import { useState } from 'react';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import StarRating from '../components/StarRating';
import ClinicAvatar from '../components/patient/ClinicAvatar';
import {
  getBookClinicHref,
  getPatientClinicHref,
  PATIENT_CLINIC_LOCATOR_HREF,
} from '../config/patientNavigation';
import { LOCATOR_CLINICS } from '../mocks/clinicProfiles';
import { MOCK_DASHBOARD_NOTIFICATIONS, MOCK_PATIENT } from '../mocks/patientDashboard';
import '../components/patient/patientPanel.css';
import './ClinicLocatorPage.css';

const matchesQuery = (clinic, query) => {
  const term = query.trim().toLowerCase();
  return (
    !term ||
    clinic.name.toLowerCase().includes(term) ||
    clinic.location.toLowerCase().includes(term)
  );
};

// Clinic Locator with MOCK clinics. The map is a TEMPORARY placeholder with
// pins at approximate positions until a map provider is integrated.
function ClinicLocatorPage({ clinics = LOCATOR_CLINICS }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(clinics[0]?.id ?? null);
  const results = clinics.filter((clinic) => matchesQuery(clinic, query));
  const selected = clinics.find(({ id }) => id === selectedId);

  return (
    <PatientLayout
      title="Clinic Locator"
      activeHref={PATIENT_CLINIC_LOCATOR_HREF}
      user={MOCK_PATIENT}
      hasUnreadNotifications={MOCK_DASHBOARD_NOTIFICATIONS.some(({ unread }) => unread)}
    >
      <div className="clinic-locator">
        <div className="clinic-locator-list-column">
          <label className="clinic-locator-search">
            <span className="visually-hidden">Search clinics</span>
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Search clinics..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          {results.length > 0 ? (
            <ul className="clinic-locator-list" aria-label="Clinics">
              {results.map((clinic) => {
                const isSelected = clinic.id === selectedId;
                return (
                  <li key={clinic.id}>
                    <button
                      type="button"
                      className={`clinic-locator-item${isSelected ? ' is-selected' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(clinic.id)}
                    >
                      <ClinicAvatar accent={clinic.accent} size="sm" />
                      <span className="clinic-locator-item-text">
                        <span className="clinic-locator-item-name">{clinic.name}</span>
                        <span className="clinic-locator-item-location">{clinic.location}</span>
                        <StarRating rating={clinic.rating} size={14} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="clinic-locator-empty" role="status">
              No clinics match your search.
            </p>
          )}
        </div>

        <div className="clinic-locator-map-column">
          <div className="clinic-locator-map">
            <div className="clinic-locator-map-label" aria-hidden="true">
              <Icon name="map" size={56} />
              <span>Interactive map</span>
              <span className="clinic-locator-map-sub">Bukidnon Province</span>
            </div>
            {results.map((clinic) => {
              const isSelected = clinic.id === selectedId;
              return (
                <button
                  key={clinic.id}
                  type="button"
                  className={`clinic-locator-pin${isSelected ? ' is-selected' : ''}`}
                  style={{
                    left: `${clinic.mapPosition.x}%`,
                    top: `${clinic.mapPosition.y}%`,
                  }}
                  aria-label={`Show ${clinic.name} on map`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(clinic.id)}
                >
                  <Icon name="mapPin" size={isSelected ? 20 : 16} />
                </button>
              );
            })}
          </div>

          {selected && (
            <section className="clinic-locator-selected" aria-label={`Selected clinic: ${selected.name}`}>
              <ClinicAvatar accent={selected.accent} size="lg" />
              <div className="clinic-locator-selected-body">
                <div className="clinic-locator-selected-heading">
                  <h2 className="clinic-locator-selected-name">{selected.name}</h2>
                  {selected.verified && (
                    <span className="clinic-locator-verified">
                      <Icon name="shieldCheck" size={13} />
                      Verified
                    </span>
                  )}
                </div>
                <p className="clinic-locator-selected-address">
                  <Icon name="mapPin" size={14} />
                  {selected.address}
                </p>
                <p className="clinic-locator-selected-meta">
                  <StarRating rating={selected.rating} size={15} />
                  <span>
                    {selected.rating.toFixed(1)} ({selected.reviewCount} reviews)
                  </span>
                  {selected.hours && (
                    <span className="clinic-locator-selected-hours">{selected.hours}</span>
                  )}
                </p>
              </div>
              <div className="clinic-locator-selected-actions">
                <a href={getPatientClinicHref(selected.id)} className="btn clinic-locator-details">
                  Details
                </a>
                <a href={getBookClinicHref(selected.id)} className="btn btn-primary">
                  Book
                </a>
              </div>
            </section>
          )}
        </div>
      </div>
    </PatientLayout>
  );
}

export default ClinicLocatorPage;
