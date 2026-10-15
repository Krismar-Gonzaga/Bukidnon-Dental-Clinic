import { useQuery } from '@tanstack/react-query';
import Icon from '../Icon';
import { getClinicMap } from '../../services/publicApi';
import { getPublicClinicHref } from '../../config/navigation';
import { PATIENT_CLINIC_LOCATOR_HREF } from '../../config/patientNavigation';
import { useAuth } from '../../auth/AuthContext';
import { hasCoordinates, projectToMap } from '../../utils/maps';
import './ClinicsMapSection.css';

// Static Bukidnon map preview: pins are placed from each clinic's saved
// coordinates (clinics without coordinates are listed but not pinned).
// The full interactive map is the patient Clinic Locator.
function ClinicsMapSection() {
  const { user } = useAuth();
  const clinics = useQuery({ queryKey: ['clinics', 'map'], queryFn: getClinicMap });
  const pinned = (clinics.data ?? [])
    .filter(hasCoordinates)
    .map((clinic) => ({ clinic, position: projectToMap(clinic) }))
    .filter(({ position }) => position);
  const fullMapHref = user?.role === 'patient' ? PATIENT_CLINIC_LOCATOR_HREF : '/clinics';

  return (
    <section className="clinics-map-section" aria-labelledby="clinics-map-title">
      <div className="clinics-map-inner">
        <div className="clinics-map-header">
          <div>
            <h2 id="clinics-map-title" className="clinics-map-title">
              Find Clinics Near You
            </h2>
            <p className="clinics-map-text">Explore dental clinics across Bukidnon and find one close to you.</p>
          </div>
          <a href={fullMapHref} className="btn btn-outline">
            <Icon name="mapPin" size={18} />
            Open Full Map
          </a>
        </div>

        <div className="clinics-map">
          <ul className="clinics-map-markers" aria-label="Clinic locations">
            {pinned.map(({ clinic, position }) => (
              <li
                key={clinic.id}
                className="clinics-map-marker"
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
              >
                <a href={getPublicClinicHref(clinic.id)} className="clinics-map-pin" aria-label={clinic.name}>
                  <Icon name="mapPin" size={18} />
                </a>
                <span className="clinics-map-label">
                  <span className="clinics-map-label-name">{clinic.name}</span>
                  <span className="clinics-map-label-location">{clinic.location}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="clinics-map-note">
            {pinned.length > 0
              ? 'Map preview (not to scale)'
              : 'Map preview (clinic locations appear here once clinics add their coordinates)'}
          </p>
        </div>
      </div>
    </section>
  );
}

export default ClinicsMapSection;
