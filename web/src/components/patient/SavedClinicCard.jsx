import Icon from '../Icon';
import StarRating from '../StarRating';
import ClinicAvatar from './ClinicAvatar';
import { getBookClinicHref, getPatientClinicHref } from '../../config/patientNavigation';
import './patientPanel.css';
import './SavedClinicCard.css';

function SavedClinicCard({ clinic, onUnsave }) {
  const { id, name, location, rating, reviewCount, accent } = clinic;

  return (
    <article className="saved-clinic-card" aria-label={name}>
      <ClinicAvatar accent={accent} size="lg" />
      <div className="saved-clinic-body">
        <h2 className="saved-clinic-name">{name}</h2>
        <p className="saved-clinic-location">
          <Icon name="mapPin" size={14} />
          {location}
        </p>
        <p className="saved-clinic-rating">
          <StarRating rating={rating} size={15} />
          <span>
            {rating.toFixed(1)} ({reviewCount} reviews)
          </span>
        </p>
        <div className="saved-clinic-actions">
          <a href={getBookClinicHref(id)} className="btn btn-primary patient-btn-sm">
            Book
          </a>
          <a href={getPatientClinicHref(id)} className="btn patient-btn-sm patient-btn-outline">
            Details
          </a>
        </div>
      </div>
      <button
        type="button"
        className="saved-clinic-heart"
        aria-label={`Remove ${name} from saved clinics`}
        onClick={() => onUnsave(id)}
      >
        <Icon name="heart" size={22} />
      </button>
    </article>
  );
}

export default SavedClinicCard;
