import ClinicCard from '../ClinicCard';
import Icon from '../Icon';
import { EmptyState, ErrorState, LoadingState } from '../StatusMessage';
import { useHomeData } from '../../hooks/useHomeData';
import { useAuth } from '../../auth/AuthContext';
import { FIND_CLINICS_HREF, getLoginHref, getPublicClinicHref } from '../../config/navigation';
import { getBookClinicHref } from '../../config/patientNavigation';
import './FeaturedClinics.css';

// Highest-rated listed clinics from GET /home.
function FeaturedClinics() {
  const home = useHomeData();
  const { user } = useAuth();
  const bookHref = (id) =>
    user?.role === 'patient' ? getBookClinicHref(id) : getLoginHref(getBookClinicHref(id));

  const renderClinics = () => {
    if (home.isPending) return <LoadingState label="Loading featured clinics…" />;
    if (home.isError) return <ErrorState error={home.error} onRetry={() => home.refetch()} />;
    if (home.data.featuredClinics.length === 0) return <EmptyState title="No clinics are listed yet." />;
    return (
      <ul className="featured-clinics-grid">
        {home.data.featuredClinics.map((clinic) => (
          <li key={clinic.id}>
            <ClinicCard clinic={clinic} bookHref={bookHref(clinic.id)} detailsHref={getPublicClinicHref(clinic.id)} />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <section className="featured-clinics" aria-labelledby="featured-clinics-title">
      <div className="featured-clinics-inner">
        <div className="featured-clinics-header">
          <div>
            <h2 id="featured-clinics-title" className="featured-clinics-title">
              Featured Clinics
            </h2>
            <p className="featured-clinics-text">Highly rated dental care centers in your vicinity.</p>
          </div>
          <a href={FIND_CLINICS_HREF} className="featured-clinics-link">
            View All Clinics
            <Icon name="arrowRight" size={18} />
          </a>
        </div>
        {renderClinics()}
      </div>
    </section>
  );
}

export default FeaturedClinics;
