import { useQuery } from '@tanstack/react-query';
import { SERVICES_HREF } from '../../config/navigation';
import { getServiceCatalog } from '../../services/publicApi';
import './AffordableCare.css';

const SHOWN = 4;

// Published price ranges across listed clinics, for services clinics offer
// (GET /services). Hidden until clinics publish prices.
function AffordableCare() {
  const catalog = useQuery({ queryKey: ['services', 'catalog'], queryFn: getServiceCatalog });
  const services = (catalog.data ?? []).filter((s) => s.clinicCount > 0).slice(0, SHOWN);

  if (services.length === 0) return null;

  return (
    <section className="affordable-care" aria-labelledby="affordable-care-title">
      <div className="affordable-care-inner">
        <div className="affordable-care-intro">
          <span className="affordable-care-label">Services</span>
          <h2 id="affordable-care-title" className="affordable-care-title">
            Affordable Care for Everyone
          </h2>
          <p className="affordable-care-text">We bridge the gap between high-quality dental care and transparency in pricing across Bukidnon.</p>
          <a href={SERVICES_HREF} className="affordable-care-link">
            See all services
          </a>
        </div>

        <ul className="affordable-care-grid">
          {services.map((service) => (
            <li key={service.id} className="service-price-card">
              <h3 className="service-price-card-name">{service.name}</h3>
              <p className="service-price-card-text">{service.description}</p>
              <p className="service-price-card-price">{service.priceLabel}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default AffordableCare;
