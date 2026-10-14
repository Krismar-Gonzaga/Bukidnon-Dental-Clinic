import Icon from './Icon';
import './ClinicCard.css';

// Actions are visual only until routing/booking are implemented.
function ClinicCard({ clinic }) {
  const { name, location, rating, reviewCount, tags, imageSrc } = clinic;
  const titleId = `${clinic.id}-name`;

  return (
    <article className="clinic-card" aria-labelledby={titleId}>
      {imageSrc ? (
        <img className="clinic-card-image" src={imageSrc} alt={name} />
      ) : (
        // TEMPORARY placeholder until real clinic photos are available
        <div
          className="clinic-card-image clinic-card-image-placeholder"
          role="img"
          aria-label="Placeholder for clinic photo"
        >
          <Icon name="building" size={36} />
        </div>
      )}

      <div className="clinic-card-body">
        <p className="clinic-card-rating">
          <Icon name="star" size={16} className="clinic-card-star" />
          <span className="clinic-card-rating-value">{rating.toFixed(1)}</span>
          <span className="clinic-card-reviews">({reviewCount} reviews)</span>
        </p>

        <h3 id={titleId} className="clinic-card-name">
          {name}
        </h3>

        <p className="clinic-card-location">
          <Icon name="mapPin" size={16} />
          {location}
        </p>

        <ul className="clinic-card-tags" aria-label="Services">
          {tags.map((tag) => (
            <li key={tag} className="clinic-card-tag">
              {tag}
            </li>
          ))}
        </ul>

        <div className="clinic-card-actions">
          <button type="button" className="btn btn-primary btn-sm">
            Book Appointment
          </button>
          <button type="button" className="btn btn-outline btn-sm">
            View Details
          </button>
        </div>
      </div>
    </article>
  );
}

export default ClinicCard;
