import StarRating from '../StarRating';
import { useHomeData } from '../../hooks/useHomeData';
import './Testimonials.css';

const AVATAR_TONES = ['is-navy', 'is-green', 'is-slate'];

// Recent published reviews from verified visits (GET /home). The section is
// hidden until there are reviews with comments: testimonials are never invented.
function Testimonials() {
  const home = useHomeData();
  const reviews = (home.data?.reviews ?? []).filter(({ quote }) => quote).slice(0, 3);

  if (reviews.length === 0) return null;

  return (
    <section className="testimonials" aria-labelledby="testimonials-title">
      <div className="testimonials-inner">
        <h2 id="testimonials-title" className="testimonials-title">
          What Patients Say
        </h2>

        <ul className="testimonials-grid">
          {reviews.map((item, index) => (
            <li key={item.id} className="testimonial-card">
              <figure className="testimonial-figure">
                <StarRating rating={item.rating} size={20} />
                <blockquote className="testimonial-quote">
                  <p>{item.quote}</p>
                </blockquote>
                <figcaption className="testimonial-author">
                  <span className={`testimonial-avatar ${AVATAR_TONES[index % AVATAR_TONES.length]}`} aria-hidden="true">
                    {item.name.charAt(0).toUpperCase()}
                  </span>
                  <span>
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
