import './AffordableCare.css';

// Static homepage copy with indicative price ranges from the Figma design.
// Not backend data; actual clinic prices will come from the API later.
const SERVICES = [
  {
    name: 'Dental Cleaning',
    description:
      'Professional prophylaxis to remove plaque and prevent gum disease.',
    price: '₱500 - ₱1,500',
  },
  {
    name: 'Tooth Extraction',
    description: 'Safe and painless removal of damaged or problematic teeth.',
    price: '₱1,000 - ₱3,000',
  },
  {
    name: 'Braces Consultation',
    description:
      'Complete diagnostic and treatment planning for orthodontics.',
    price: 'FREE - ₱500',
  },
  {
    name: 'Teeth Whitening',
    description: 'Advanced bleaching for a radiant, brighter-than-ever smile.',
    price: 'Starts at ₱5,000',
  },
];

function AffordableCare() {
  return (
    <section className="affordable-care" aria-labelledby="affordable-care-title">
      <div className="affordable-care-inner">
        <div className="affordable-care-intro">
          <span className="affordable-care-label">Services</span>
          <h2 id="affordable-care-title" className="affordable-care-title">
            Affordable Care for Everyone
          </h2>
          <p className="affordable-care-text">
            We bridge the gap between high-quality dental care and transparency
            in pricing across Bukidnon.
          </p>
        </div>

        <ul className="affordable-care-grid">
          {SERVICES.map((service) => (
            <li key={service.name} className="service-price-card">
              <h3 className="service-price-card-name">{service.name}</h3>
              <p className="service-price-card-text">{service.description}</p>
              <p className="service-price-card-price">{service.price}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default AffordableCare;
