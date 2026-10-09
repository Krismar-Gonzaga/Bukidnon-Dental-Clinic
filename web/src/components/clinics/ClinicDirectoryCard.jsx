import Icon from '../Icon';
import './ClinicDirectoryCard.css';

// Number of decorative header gradients defined in ClinicDirectoryCard.css.
const ACCENT_COUNT = 6;

// Directory listing card. Actions are visual only until routing/booking exist.
// The gradient header is a TEMPORARY stand-in for clinic photos.
function ClinicDirectoryCard({ clinic, accentIndex = 0 }) {
  const {
    id,
    name,
    location,
    province,
    rating,
    reviewCount,
    specializations,
    verified,
  } = clinic;
  const titleId = `${id}-name`;
  const accent = (accentIndex % ACCENT_COUNT) + 1;

  return (
    <article className="clinic-dir-card" aria-labelledby={titleId}>
      <div className={`clinic-dir-card-media clinic-dir-card-media--${accent}`}>
        {verified && (
          <span className="clinic-dir-card-verified">
            <Icon name="shieldCheck" size={13} />
            Verified
          </span>
        )}
        <span
          className="clinic-dir-card-rating"
          aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${reviewCount} reviews`}
        >
          <Icon name="star" size={15} className="clinic-dir-card-star" />
          <span aria-hidden="true">
            {rating.toFixed(1)} ({reviewCount})
          </span>
        </span>
        <Icon name="building" size={64} className="clinic-dir-card-media-icon" />
      </div>

      <div className="clinic-dir-card-body">
        <h3 id={titleId} className="clinic-dir-card-name">
          {name}
        </h3>

        <p className="clinic-dir-card-location">
          <Icon name="mapPin" size={15} />
          {location}, {province}
        </p>

        <ul className="clinic-dir-card-tags" aria-label="Specializations">
          {specializations.map((specialization) => (
            <li key={specialization} className="clinic-dir-card-tag">
              {specialization}
            </li>
          ))}
        </ul>

        <div className="clinic-dir-card-actions">
          <button type="button" className="btn btn-primary">
            Book Appointment
          </button>
          <button type="button" className="btn clinic-dir-card-details">
            View Details
          </button>
        </div>
      </div>
    </article>
  );
}

export default ClinicDirectoryCard;
