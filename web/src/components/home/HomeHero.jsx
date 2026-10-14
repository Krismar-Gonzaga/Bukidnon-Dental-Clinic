import Icon from '../Icon';
import './HomeHero.css';

// TEMPORARY: the Figma hero image asset is not in the repository yet.
// Set HERO_IMAGE_SRC to the real image (e.g. an import from src/assets)
// to replace the placeholder block.
const HERO_IMAGE_SRC = null;
const HERO_IMAGE_ALT = 'Modern dental clinic treatment room';

function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-inner">
        <div className="home-hero-copy">
          <h1 id="home-hero-title" className="home-hero-title">
            <span className="home-hero-title-line">Find Trusted Dental</span>{' '}
            <span className="home-hero-title-line">Clinics Across Bukidnon</span>
          </h1>
          <p className="home-hero-text">
            Search clinics, compare services, view dentists by specialization,
            and book appointments online with the most reliable dental network
            in the province.
          </p>
          <div className="home-hero-actions">
            <button type="button" className="btn btn-primary btn-lg">
              <Icon name="search" size={18} />
              Find Clinics
            </button>
            <button type="button" className="btn btn-outline btn-lg">
              Register Now
            </button>
          </div>
        </div>

        <div className="home-hero-media">
          {HERO_IMAGE_SRC ? (
            <img
              className="home-hero-image"
              src={HERO_IMAGE_SRC}
              alt={HERO_IMAGE_ALT}
            />
          ) : (
            <div
              className="home-hero-image home-hero-image-placeholder"
              role="img"
              aria-label="Placeholder for dental clinic image"
            >
              <Icon name="tooth" size={56} />
              <span>Clinic image placeholder</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default HomeHero;
