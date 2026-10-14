import Icon from './Icon';
import './StarRating.css';

const MAX_STARS = 5;

// Shows whole filled stars (rating rounded down) out of five.
function StarRating({ rating, size = 16 }) {
  const filled = Math.floor(rating);

  return (
    <span className="star-rating" role="img" aria-label={`Rated ${rating} out of ${MAX_STARS}`}>
      {Array.from({ length: MAX_STARS }, (_, index) => (
        <Icon
          key={index}
          name="star"
          size={size}
          className={`star-rating-star${index < filled ? ' is-filled' : ''}`}
        />
      ))}
    </span>
  );
}

export default StarRating;
