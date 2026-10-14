import ClinicCard from '../ClinicCard';
import Icon from '../Icon';
import { FEATURED_CLINICS } from '../../mocks/featuredClinics';
import './FeaturedClinics.css';

// Uses mock data until the clinics API is integrated.
function FeaturedClinics() {
  return (
    <section
      className="featured-clinics"
      aria-labelledby="featured-clinics-title"
    >
      <div className="featured-clinics-inner">
        <div className="featured-clinics-header">
          <div>
            <h2 id="featured-clinics-title" className="featured-clinics-title">
              Featured Clinics
            </h2>
            <p className="featured-clinics-text">
              Highly rated dental care centers in your vicinity.
            </p>
          </div>
          <a href="#find-clinics" className="featured-clinics-link">
            View All Clinics
            <Icon name="arrowRight" size={18} />
          </a>
        </div>

        <ul className="featured-clinics-grid">
          {FEATURED_CLINICS.map((clinic) => (
            <li key={clinic.id}>
              <ClinicCard clinic={clinic} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default FeaturedClinics;
