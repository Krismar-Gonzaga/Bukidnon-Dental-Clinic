import { useQuery } from '@tanstack/react-query';
import Icon from '../Icon';
import { getClinicMap } from '../../services/publicApi';
import { CLINIC_MAP_HREF, getPublicClinicHref } from '../../config/navigation';
import { PATIENT_CLINIC_LOCATOR_HREF } from '../../config/patientNavigation';
import { useAuth } from '../../auth/AuthContext';
import { hasCoordinates, projectToMap } from '../../utils/maps';
import './ClinicsMapSection.css';

// Static Bukidnon map preview: pins are placed from each clinic's saved
// coordinates (clinics without coordinates are not pinned). The land shape is
// decorative and not to scale; Open Full Map is the interactive locator.
function ClinicsMapSection() {
  const { user } = useAuth();
  const clinics = useQuery({ queryKey: ['clinics', 'map'], queryFn: getClinicMap });
  const pinned = (clinics.data ?? [])
    .filter(hasCoordinates)
    .map((clinic) => ({ clinic, position: projectToMap(clinic) }))
    .filter(({ position }) => position);
  const fullMapHref = user?.role === 'patient' ? PATIENT_CLINIC_LOCATOR_HREF : CLINIC_MAP_HREF;

  return (
    <section className="clinics-map-section" aria-labelledby="clinics-map-title">
      <div className="clinics-map-header">
        <h2 id="clinics-map-title" className="clinics-map-title">
          Find Clinics Near You
        </h2>
        <p className="clinics-map-text">Interactive map showing dental partners across Bukidnon.</p>
      </div>

      <div className="clinics-map">
        <svg className="clinics-map-land" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
          <path d="M270 0h460c-8 40 26 66 8 110-14 34 28 62 4 110-20 40-66 54-58 110 4 28-10 50-22 70H250c26-40-6-70 20-110 22-34 66-34 62-84-3-40-58-40-46-90 8-34-34-70-16-116z" />
        </svg>
        <ul className="clinics-map-markers" aria-label="Clinic locations">
          {pinned.map(({ clinic, position }) => (
            <li key={clinic.id} className="clinics-map-marker" style={{ left: `${position.x}%`, top: `${position.y}%` }}>
              <a href={getPublicClinicHref(clinic.id)} className="clinics-map-pin" aria-label={clinic.name} title={clinic.name}>
                <Icon name="mapPin" size={24} />
              </a>
            </li>
          ))}
        </ul>

        <div className="clinics-map-card">
          <Icon name="map" size={40} />
          <h3 className="clinics-map-card-title">Explore Local Clinics</h3>
          <p className="clinics-map-card-text">Access our full interactive map to find the nearest clinic to your current location.</p>
          <a href={fullMapHref} className="btn btn-primary clinics-map-card-button">
            Open Full Map
          </a>
        </div>
      </div>
    </section>
  );
}

export default ClinicsMapSection;
