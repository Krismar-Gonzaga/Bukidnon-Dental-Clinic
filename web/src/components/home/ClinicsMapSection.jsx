import Icon from '../Icon';
import { CLINIC_MAP_MARKERS } from '../../mocks/clinicMapMarkers';
import './ClinicsMapSection.css';

// TEMPORARY: CSS map placeholder. No map provider or API key is used yet.
// Replace the .clinics-map canvas with the real map component later;
// markers already come from a separate data source.
function ClinicsMapSection() {
  return (
    <section className="clinics-map-section" aria-labelledby="clinics-map-title">
      <div className="clinics-map-inner">
        <div className="clinics-map-header">
          <div>
            <h2 id="clinics-map-title" className="clinics-map-title">
              Find Clinics Near You
            </h2>
            <p className="clinics-map-text">
              Explore dental clinics across Bukidnon and find one close to you.
            </p>
          </div>
          <button type="button" className="btn btn-outline">
            <Icon name="mapPin" size={18} />
            Open Full Map
          </button>
        </div>

        <div className="clinics-map">
          <ul className="clinics-map-markers" aria-label="Clinic locations">
            {CLINIC_MAP_MARKERS.map((marker) => (
              <li
                key={marker.id}
                className="clinics-map-marker"
                style={{
                  left: `${marker.position.x}%`,
                  top: `${marker.position.y}%`,
                }}
              >
                <span className="clinics-map-pin">
                  <Icon name="mapPin" size={18} />
                </span>
                <span className="clinics-map-label">
                  <span className="clinics-map-label-name">{marker.name}</span>
                  <span className="clinics-map-label-location">
                    {marker.location}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="clinics-map-note">Map preview (not to scale)</p>
        </div>
      </div>
    </section>
  );
}

export default ClinicsMapSection;
