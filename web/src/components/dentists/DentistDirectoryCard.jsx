import Icon from '../Icon';
import './DentistDirectoryCard.css';

// Number of avatar colors defined in DentistDirectoryCard.css.
const ACCENT_COUNT = 6;
const MAX_STARS = 5;

// Directory listing card. View Profile is visual only until profiles exist.
// The letter avatar is a TEMPORARY stand-in for dentist photos.
function DentistDirectoryCard({ dentist, accentIndex = 0 }) {
  const {
    id,
    name,
    specialty,
    clinicName,
    rating,
    reviewCount,
    yearsExperience,
    available,
  } = dentist;
  const titleId = `${id}-name`;
  const accent = (accentIndex % ACCENT_COUNT) + 1;
  // Initial of the first name after any title such as "Dr."
  const initial = name.replace(/^Dr\.?\s+/i, '').charAt(0).toUpperCase();
  // Figma shows whole stars only (e.g. 4.9 renders four filled stars).
  const filledStars = Math.floor(rating);

  return (
    <article className="dentist-card" aria-labelledby={titleId}>
      <div
        className={`dentist-card-avatar dentist-card-avatar--${accent}`}
        aria-hidden="true"
      >
        {initial}
      </div>

      <h3 id={titleId} className="dentist-card-name">
        {name}
      </h3>
      <p className="dentist-card-specialty">{specialty}</p>
      {clinicName && (
        <p className="dentist-card-clinic">
          <Icon name="building" size={13} />
          {clinicName}
        </p>
      )}

      <p className="dentist-card-rating">
        <span
          className="dentist-card-stars"
          role="img"
          aria-label={`Rated ${rating.toFixed(1)} out of 5`}
        >
          {Array.from({ length: MAX_STARS }, (_, index) => (
            <Icon
              key={index}
              name="star"
              size={15}
              className={
                index < filledStars
                  ? 'dentist-card-star is-filled'
                  : 'dentist-card-star'
              }
            />
          ))}
        </span>
        <span>
          {rating.toFixed(1)} ({reviewCount} reviews)
        </span>
      </p>

      <ul className="dentist-card-meta" aria-label="Details">
        <li className="dentist-card-chip">{yearsExperience} years exp.</li>
        <li
          className={`dentist-card-chip ${
            available ? 'is-available' : 'is-unavailable'
          }`}
        >
          {available ? 'Available' : 'Unavailable'}
        </li>
      </ul>

      <button type="button" className="btn btn-primary dentist-card-action">
        View Profile
      </button>
    </article>
  );
}

export default DentistDirectoryCard;
