import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import Icon from '../components/Icon';
import StarRating from '../components/StarRating';
import Tabs from '../components/Tabs';
import ClinicOverview from '../components/clinics/ClinicOverview';
import DentistDirectoryCard from '../components/dentists/DentistDirectoryCard';
import ServiceCard from '../components/services/ServiceCard';
import { ErrorState, LoadingState } from '../components/StatusMessage';
import { getBookClinicHref, PATIENT_FIND_CLINICS_HREF } from '../config/patientNavigation';
import { FIND_CLINICS_HREF, getLoginHref } from '../config/navigation';
import { useAuth } from '../auth/AuthContext';
import { getClinic } from '../services/publicApi';
import { getSavedClinics, saveClinic, unsaveClinic } from '../services/patientApi';
import { SAVED_CLINICS_KEY } from './SavedClinicsPage';
import './ClinicDetailsPage.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'dentists', label: 'Dentists' },
  { id: 'services', label: 'Services' },
  { id: 'reviews', label: 'Reviews' },
];

function ReviewList({ reviews }) {
  if (reviews.length === 0) return <p className="clinic-details-empty">No reviews yet.</p>;
  return (
    <ul className="clinic-details-reviews">
      {reviews.map((review) => (
        <li key={review.id} className="clinic-details-review">
          <StarRating rating={review.rating} size={15} />
          {review.comment && <p className="clinic-details-review-text">{review.comment}</p>}
          <p className="clinic-details-review-meta">
            {review.patientName}
            {review.isVerifiedVisit && ' · Verified visit'}
            {review.date && ` · ${review.date}`}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * A listed clinic's public profile. Patients can save the clinic and book;
 * guests are sent to sign in first.
 */
function ClinicDetailsPage({ clinicId }) {
  const { user } = useAuth();
  const isPatient = user?.role === 'patient';
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const query = useQuery({ queryKey: ['clinic', clinicId], queryFn: () => getClinic(clinicId) });
  const saved = useQuery({ queryKey: SAVED_CLINICS_KEY, queryFn: getSavedClinics, enabled: isPatient });
  const isSaved = Boolean(saved.data?.some(({ id }) => id === String(clinicId)));

  const toggleSave = useMutation({
    mutationFn: () => (isSaved ? unsaveClinic(clinicId) : saveClinic(clinicId)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['patient'] }),
  });

  const bookHref = isPatient ? getBookClinicHref(clinicId) : getLoginHref(getBookClinicHref(clinicId));
  const backHref = isPatient ? PATIENT_FIND_CLINICS_HREF : FIND_CLINICS_HREF;

  if (query.isPending || query.isError) {
    return (
      <div className="clinic-details-page">
        <SiteHeader activeHref="/clinics" />
        <main className="clinic-details-container clinic-details-missing">
          {query.isPending ? (
            <LoadingState label="Loading clinic…" />
          ) : (
            <>
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
              <a href={backHref}>Back to Find Clinics</a>
            </>
          )}
        </main>
        <SiteFooter />
      </div>
    );
  }

  const clinic = query.data;
  const { name, address, rating, reviewCount, specializations, verified, accent } = clinic;

  const renderPanel = () => {
    if (activeTab === 'overview') return <ClinicOverview clinic={clinic} bookHref={bookHref} />;
    if (activeTab === 'dentists') {
      return clinic.dentists.length > 0 ? (
        <ul className="clinic-details-grid">
          {clinic.dentists.map((dentist, index) => (
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
      return clinic.services.length > 0 ? (
        <ul className="clinic-details-grid">
          {clinic.services.map((service) => (
            <li key={service.id}>
              <ServiceCard service={service} actionHref={bookHref} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="clinic-details-empty">This clinic has not published services yet.</p>
      );
    }
    return <ReviewList reviews={clinic.reviews} />;
  };

  return (
    <div className="clinic-details-page">
      <SiteHeader activeHref="/clinics" />

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
              {isPatient && (
                <button
                  type="button"
                  className={`clinic-details-save${isSaved ? ' is-saved' : ''}`}
                  aria-pressed={isSaved}
                  aria-label={isSaved ? `Remove ${name} from saved clinics` : `Save ${name}`}
                  disabled={toggleSave.isPending || saved.isPending}
                  onClick={() => toggleSave.mutate()}
                >
                  <Icon name="heart" size={20} />
                </button>
              )}
              <a href={bookHref} className="btn btn-primary">
                Book Appointment
              </a>
            </div>
          </div>

          <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} idPrefix="clinic" label="Clinic sections" />
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
