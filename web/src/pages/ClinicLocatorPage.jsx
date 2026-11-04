import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import StarRating from '../components/StarRating';
import ClinicAvatar from '../components/patient/ClinicAvatar';
import { QueryState } from '../components/StatusMessage';
import {
  getBookClinicHref,
  getPatientClinicHref,
  PATIENT_CLINIC_LOCATOR_HREF,
} from '../config/patientNavigation';
import { getClinicMap } from '../services/publicApi';
import {
  directionsUrl,
  embedUrl,
  hasCoordinates,
  projectToMap,
  requestCurrentPosition,
} from '../utils/maps';
import '../components/patient/patientPanel.css';
import './ClinicLocatorPage.css';

const matchesQuery = (clinic, query) => {
  const term = query.trim().toLowerCase();
  return !term || clinic.name.toLowerCase().includes(term) || clinic.location.toLowerCase().includes(term);
};

// Also the guest map page (ClinicMapPage), which passes its own links.
export function Locator({ clinics, getDetailsHref = getPatientClinicHref, getBookHref = getBookClinicHref }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(clinics[0]?.id ?? null);
  const [origin, setOrigin] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const results = clinics.filter((clinic) => matchesQuery(clinic, query));
  const selected = clinics.find(({ id }) => id === selectedId);
  const mapSrc = embedUrl(selected);

  const handleUseLocation = async () => {
    setIsLocating(true);
    setLocationError('');
    try {
      setOrigin(await requestCurrentPosition());
    } catch (error) {
      setLocationError(error.message);
    } finally {
      setIsLocating(false);
    }
  };

  return (
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
        {mapSrc ? (
          <iframe
            title={`Map of ${selected.name}`}
            className="clinic-locator-map clinic-locator-embed"
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="clinic-locator-map">
            <div className="clinic-locator-map-label" aria-hidden="true">
              <Icon name="map" size={56} />
              <span>Map preview</span>
              <span className="clinic-locator-map-sub">Bukidnon Province (not to scale)</span>
            </div>
            {results.filter(hasCoordinates).map((clinic) => {
              const position = projectToMap(clinic);
              if (!position) return null;
              const isSelected = clinic.id === selectedId;
              return (
                <button
                  key={clinic.id}
                  type="button"
                  className={`clinic-locator-pin${isSelected ? ' is-selected' : ''}`}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  aria-label={`Show ${clinic.name} on map`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(clinic.id)}
                >
                  <Icon name="mapPin" size={isSelected ? 20 : 16} />
                </button>
              );
            })}
          </div>
        )}

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
                <span>{selected.rating.toFixed(1)}</span>
              </p>
              <p className="clinic-locator-selected-links">
                <a href={directionsUrl(selected, origin)} target="_blank" rel="noreferrer">
                  Directions
                  <span className="visually-hidden"> (opens Google Maps in a new tab)</span>
                </a>
                {!origin && (
                  <button type="button" onClick={handleUseLocation} disabled={isLocating}>
                    {isLocating ? 'Locating…' : 'Use My Location'}
                  </button>
                )}
              </p>
              {locationError && (
                <p className="clinic-locator-location-error" role="alert">
                  {locationError}
                </p>
              )}
            </div>
            <div className="clinic-locator-selected-actions">
              <a href={getDetailsHref(selected.id)} className="btn clinic-locator-details">
                Details
              </a>
              <a href={getBookHref(selected.id)} className="btn btn-primary">
                Book
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ClinicLocatorPage() {
  const query = useQuery({ queryKey: ['clinics', 'map'], queryFn: getClinicMap });

  return (
    <PatientLayout title="Clinic Locator" activeHref={PATIENT_CLINIC_LOCATOR_HREF}>
      <QueryState query={query} loadingLabel="Loading clinics…">
        {(clinics) => <Locator clinics={clinics} />}
      </QueryState>
    </PatientLayout>
  );
}

export default ClinicLocatorPage;
