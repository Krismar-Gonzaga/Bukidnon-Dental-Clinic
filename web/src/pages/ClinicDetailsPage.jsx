import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../components/Icon';
import StarRating from '../components/StarRating';
import Tabs from '../components/Tabs';
import ClinicOverview from '../components/clinics/ClinicOverview';
import ServiceCard from '../components/services/ServiceCard';
import { ErrorState, LoadingState } from '../components/StatusMessage';
import { getBookClinicHref } from '../config/patientNavigation';
import { FIND_CLINICS_HREF, getLoginHref, getPublicClinicHref, getPublicDentistHref } from '../config/navigation';
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
          <div className="clinic-details-review-author">
            <span className="clinic-details-review-avatar" aria-hidden="true">
              {review.patientName.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="clinic-details-review-name">{review.patientName}</p>
              <p className="clinic-details-review-meta">{[review.isVerifiedVisit && 'Verified visit', review.date].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DentistRow({ dentist, accentIndex }) {
  const hasRating = typeof dentist.rating === 'number';
  const initial = dentist.name.replace(/^Dr\.?\s+/i, '').charAt(0).toUpperCase();
  return (
    <article className="clinic-details-dentist">
      <span className={`clinic-details-dentist-avatar is-${(accentIndex % 6) + 1}`} aria-hidden="true">
        {initial}
      </span>
      <div className="clinic-details-dentist-body">
        <div className="clinic-details-dentist-head">
          <h3 className="clinic-details-dentist-name">{dentist.name}</h3>
          <span className={`clinic-details-dentist-status${dentist.available ? ' is-available' : ''}`}>{dentist.available ? 'Available' : 'Unavailable'}</span>
        </div>
        <p className="clinic-details-dentist-meta">{dentist.specialty}</p>
        {hasRating && (
          <p className="clinic-details-dentist-rating">
            <StarRating rating={dentist.rating} size={14} />
            {dentist.rating.toFixed(1)} ({dentist.reviewCount} {dentist.reviewCount === 1 ? 'review' : 'reviews'})
          </p>
        )}
        <p className="clinic-details-dentist-years">{dentist.yearsExperience} years experience</p>
        <a href={getPublicDentistHref(dentist.id)} className="clinic-details-dentist-link" aria-label={`View profile of ${dentist.name}`}>
          View Profile
          <Icon name="arrowRight" size={14} />
        </a>
      </div>
    </article>
  );
}

// Guest frame; the app shell provides the shared site header and footer.
function PublicShell({ children }) {
  return (
    <div className="clinic-details-page">
      <main>{children}</main>
    </div>
  );
}

/**
 * A listed clinic's public profile. Patients can save the clinic and book;
 * guests are sent to sign in first.
 */
function ClinicDetailsPage({ clinicId }) {
  const Shell = PublicShell;
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

  if (query.isPending || query.isError) {
    return (
      <Shell>
        <div className="clinic-details-container clinic-details-missing">
          {query.isPending ? (
            <LoadingState label="Loading clinic…" />
          ) : (
            <>
              <ErrorState error={query.error} onRetry={() => query.refetch()} />
              <a href={FIND_CLINICS_HREF}>Back to Find Clinics</a>
            </>
          )}
        </div>
      </Shell>
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
              <DentistRow dentist={dentist} accentIndex={index} />
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
              <ServiceCard service={service} />
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
    <Shell>
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
            {!isPatient && (
              <a href={getLoginHref(getPublicClinicHref(clinicId))} className="clinic-details-save" aria-label={`Sign in to save ${name}`}>
                <Icon name="heart" size={20} />
              </a>
            )}
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
    </Shell>
  );
}

export default ClinicDetailsPage;
