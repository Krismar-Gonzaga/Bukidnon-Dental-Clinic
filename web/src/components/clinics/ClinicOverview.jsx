import Icon from '../Icon';
import './ClinicOverview.css';

const GALLERY_PLACEHOLDERS = 3;

// Overview tab of a clinic's page. Fields the clinic has not provided are
// left out. The map and gallery are TEMPORARY placeholders until map and
// photo support exist.
function ClinicOverview({ clinic, bookHref }) {
  const { name, address, hours, phone, email, accent } = clinic;
  const infoRows = [
    { label: 'Address', value: address, icon: 'mapPin' },
    { label: 'Operating Hours', value: hours, icon: 'clock' },
    { label: 'Phone', value: phone, icon: 'phone' },
    { label: 'Email', value: email, icon: 'mail' },
  ].filter(({ value }) => value);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${name}, ${address}`
  )}`;

  return (
    <div className="clinic-overview">
      <div className="clinic-overview-main">
        <section className="clinic-overview-card" aria-labelledby="clinic-info-title">
          <h2 id="clinic-info-title" className="clinic-overview-title">
            Clinic Information
          </h2>
          <dl className="clinic-overview-info">
            {infoRows.map(({ label, value, icon }) => (
              <div key={label} className="clinic-overview-info-row">
                <Icon name={icon} size={18} />
                <div>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <section className="clinic-overview-card" aria-labelledby="clinic-gallery-title">
          <h2 id="clinic-gallery-title" className="clinic-overview-title">
            Gallery
          </h2>
          <div className="clinic-overview-gallery">
            {Array.from({ length: GALLERY_PLACEHOLDERS }, (_, index) => (
              <span
                key={index}
                className={`clinic-overview-photo clinic-overview-photo--accent-${accent}`}
                aria-hidden="true"
              >
                <Icon name="building" size={32} />
              </span>
            ))}
          </div>
          <p className="visually-hidden">Clinic photos are not available yet.</p>
        </section>
      </div>

      <div className="clinic-overview-side">
        <section className="clinic-overview-card" aria-labelledby="clinic-location-title">
          <h2 id="clinic-location-title" className="clinic-overview-title">
            Location
          </h2>
          <div className="clinic-overview-map" aria-hidden="true">
            <Icon name="map" size={36} />
          </div>
          <p className="clinic-overview-address">{address}</p>
          <a
            href={mapsHref}
            className="clinic-overview-maps-link"
            target="_blank"
            rel="noreferrer"
          >
            Open in Maps
            <Icon name="arrowRight" size={14} />
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </section>

        <section className="clinic-overview-card" aria-labelledby="clinic-quick-book-title">
          <h2 id="clinic-quick-book-title" className="clinic-overview-title">
            Quick Book
          </h2>
          <p className="clinic-overview-text">
            Ready to book your appointment at {name}?
          </p>
          <a href={bookHref} className="btn btn-primary clinic-overview-book">
            Book Now
          </a>
        </section>
      </div>
    </div>
  );
}

export default ClinicOverview;
