import Icon from './Icon';
import './ClinicCard.css';

// Featured clinic card. bookHref / detailsHref link the actions. Clinics
// without a photo show a colored placeholder.
function ClinicCard({ clinic, bookHref, detailsHref }) {
  const { name, location, rating, reviewCount, tags, imageSrc } = clinic;
  const titleId = `${clinic.id}-name`;

  return (
    <article className="public-clinic-card" aria-labelledby={titleId}>
      <div className="clinic-card-media">
        {imageSrc ? (
          <img className="clinic-card-image" src={imageSrc} alt={name} />
        ) : (
          <div className="clinic-card-image clinic-card-image-placeholder" role="img" aria-label="Clinic photo not available yet">
            <Icon name="building" size={48} />
          </div>
        )}
        <p className="clinic-card-rating">
          <span className="clinic-card-rating-value">{rating.toFixed(1)}</span>
          {reviewCount != null && <span>({reviewCount} reviews)</span>}
          <Icon name="star" size={16} className="clinic-card-star" />
        </p>
      </div>

      <div className="clinic-card-body">
        <h3 id={titleId} className="clinic-card-name">
          {name}
        </h3>

        <p className="clinic-card-location">
          <Icon name="mapPin" size={16} />
          {location}
        </p>

        <ul className="clinic-card-tags" aria-label="Specializations">
          {tags.map((tag) => (
            <li key={tag} className="clinic-card-tag">
              {tag}
            </li>
          ))}
        </ul>

        <div className="clinic-card-actions">
          <a href={bookHref} className="btn btn-primary clinic-card-book">
            Book Appointment
          </a>
          <a href={detailsHref} className="btn btn-outline clinic-card-details">
            View Details
          </a>
        </div>
      </div>
    </article>
  );
}

export default ClinicCard;
