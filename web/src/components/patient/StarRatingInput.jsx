import Icon from '../Icon';
import { MAX_RATING, RATING_LABELS } from '../../config/reviews';
import './StarRatingInput.css';

// Five-star picker built on native radio inputs (arrow keys move the rating).
function StarRatingInput({ value, onChange, labelledBy }) {
  return (
    <div className="star-rating-input">
      <div role="radiogroup" aria-labelledby={labelledBy} className="star-rating-input-stars">
        {Array.from({ length: MAX_RATING }, (_, index) => {
          const rating = index + 1;
          return (
            <label
              key={rating}
              className={`star-rating-input-star${rating <= value ? ' is-filled' : ''}`}
            >
              <input
                type="radio"
                name="rating"
                value={rating}
                checked={rating === value}
                onChange={() => onChange(rating)}
                className="visually-hidden"
              />
              <Icon name="star" size={40} />
              <span className="visually-hidden">
                {rating} {rating === 1 ? 'star' : 'stars'}, {RATING_LABELS[rating]}
              </span>
            </label>
          );
        })}
      </div>
      <p className="star-rating-input-label" aria-live="polite">
        {RATING_LABELS[value] ?? ''}
      </p>
    </div>
  );
}

export default StarRatingInput;
