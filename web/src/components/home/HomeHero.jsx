import Icon from '../Icon';
import { FIND_CLINICS_HREF, REGISTER_HREF } from '../../config/navigation';
import heroImage from '../../assets/home-hero-clinic.jpg';
import './HomeHero.css';

// The image is cropped from the design screenshot (494 × 462 px). Replace
// src/assets/home-hero-clinic.jpg with the original artwork when available.
function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-inner">
        <div className="home-hero-copy">
          <h1 id="home-hero-title" className="home-hero-title">
            Find Trusted Dental Clinics Across Bukidnon
          </h1>
          <p className="home-hero-text">
            Search clinics, compare services, view dentists by specialization, and book appointments online with the most reliable dental network in
            the province.
          </p>
          <div className="home-hero-actions">
            <a href={FIND_CLINICS_HREF} className="btn btn-primary btn-lg home-hero-button">
              Find Clinics
              <Icon name="search" size={20} />
            </a>
            <a href={REGISTER_HREF} className="btn btn-outline btn-lg home-hero-button">
              Register Now
            </a>
          </div>
        </div>

        <div className="home-hero-media">
          <img className="home-hero-image" src={heroImage} alt="Modern dental clinic treatment room" />
        </div>
      </div>
    </section>
  );
}

export default HomeHero;
