import Icon from '../Icon';
import { TESTIMONIALS } from '../../mocks/testimonials';
import './Testimonials.css';

const MAX_RATING = 5;

function getInitials(name) {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function StarRating({ rating }) {
  return (
    <p
      className="testimonial-stars"
      role="img"
      aria-label={`Rated ${rating} out of ${MAX_RATING}`}
    >
      {Array.from({ length: MAX_RATING }, (_, index) => (
        <Icon
          key={index}
          name="star"
          size={18}
          className={
            index < rating ? 'testimonial-star is-filled' : 'testimonial-star'
          }
        />
      ))}
    </p>
  );
}

// Uses mock testimonials until verified reviews come from the backend.
function Testimonials() {
  return (
    <section className="testimonials" aria-labelledby="testimonials-title">
      <div className="testimonials-inner">
        <div className="testimonials-header">
          <h2 id="testimonials-title" className="testimonials-title">
            What Patients Say
          </h2>
          <p className="testimonials-text">
            Hear from patients who found their dentist through the
            portal.
          </p>
        </div>

        <ul className="testimonials-grid">
          {TESTIMONIALS.map((item) => (
            <li key={item.id} className="testimonial-card">
              <figure className="testimonial-figure">
                <div className="testimonial-top">
                  <StarRating rating={item.rating} />
                  <Icon name="quote" size={28} className="testimonial-quote-icon" />
                </div>
                <blockquote className="testimonial-quote">
                  <p>{item.quote}</p>
                </blockquote>
                <figcaption className="testimonial-author">
                  <span className="testimonial-avatar" aria-hidden="true">
                    {getInitials(item.name)}
                  </span>
                  <span className="testimonial-author-text">
                    <span className="testimonial-name">{item.name}</span>
                    <span className="testimonial-detail">{item.detail}</span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Testimonials;
