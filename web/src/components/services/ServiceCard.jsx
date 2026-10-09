import './ServiceCard.css';

// Service listing card. Booking is visual only until appointments exist.
function ServiceCard({ service }) {
  const { id, name, category, priceLabel, durationLabel, description } = service;
  const titleId = `${id}-name`;

  return (
    <article className="service-card" aria-labelledby={titleId}>
      <div className="service-card-header">
        <div className="service-card-heading">
          <h3 id={titleId} className="service-card-name">
            {name}
          </h3>
          <span className="service-card-category">{category}</span>
        </div>

        <div className="service-card-pricing">
          <p className="service-card-price">{priceLabel}</p>
          <p className="service-card-duration">{durationLabel}</p>
        </div>
      </div>

      <p className="service-card-description">{description}</p>

      <button type="button" className="btn btn-primary service-card-action">
        Book This Service
      </button>
    </article>
  );
}

export default ServiceCard;
