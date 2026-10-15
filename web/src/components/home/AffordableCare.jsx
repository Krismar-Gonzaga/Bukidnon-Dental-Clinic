import { useHomeData } from '../../hooks/useHomeData';
import { SERVICES_HREF } from '../../config/navigation';
import './AffordableCare.css';

const peso = (amount) => `₱${Number(amount).toLocaleString('en-PH')}`;

// Lowest published price per service across listed clinics (GET /home).
// Hidden until clinics publish prices.
function AffordableCare() {
  const home = useHomeData();
  const rates = home.data?.serviceRates ?? [];

  if (rates.length === 0) return null;

  return (
    <section className="affordable-care" aria-labelledby="affordable-care-title">
      <div className="affordable-care-inner">
        <div className="affordable-care-intro">
          <span className="affordable-care-label">Services</span>
          <h2 id="affordable-care-title" className="affordable-care-title">
            Affordable Care for Everyone
          </h2>
          <p className="affordable-care-text">
            We bridge the gap between high-quality dental care and transparency in pricing across Bukidnon.{' '}
            <a href={SERVICES_HREF}>See all services</a>
          </p>
        </div>

        <ul className="affordable-care-grid">
          {rates.map((rate) => (
            <li key={rate.name} className="service-price-card">
              <h3 className="service-price-card-name">{rate.name}</h3>
              <p className="service-price-card-text">
                Offered by {rate.clinicCount} {rate.clinicCount === 1 ? 'clinic' : 'clinics'}. Prices vary by clinic.
              </p>
              <p className="service-price-card-price">Starts at {peso(rate.startingPrice)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default AffordableCare;
