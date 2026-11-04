import Icon from '../Icon';
import { directionsUrl, embedUrl, searchUrl } from '../../utils/maps';
import './ClinicOverview.css';

const GALLERY_PLACEHOLDERS = 3;

// Overview tab of a clinic's page. Fields the clinic has not provided are
// left out. The map is embedded when a Google Maps key is configured;
// otherwise a placeholder with Google Maps links is shown. The gallery is a
// TEMPORARY placeholder until photo uploads exist.
function ClinicOverview({ clinic, bookHref }) {
  const { name, address, hours, phone, email, accent, description, branches = [] } = clinic;
  const infoRows = [
    { label: 'Address', value: address, icon: 'mapPin' },
    { label: 'Operating Hours', value: hours, icon: 'clock' },
    { label: 'Phone', value: phone, icon: 'phone' },
    { label: 'Email', value: email, icon: 'mail' },
  ].filter(({ value }) => value);
  const otherBranches = branches.filter((branch) => branch.address !== address);
  const mapSrc = embedUrl(clinic);

  return (
    <div className="public-clinic-overview">
      <div className="clinic-overview-main">
        <section className="clinic-overview-card" aria-labelledby="clinic-info-title">
          <h2 id="clinic-info-title" className="clinic-overview-title">
            Clinic Information
          </h2>
          {description && <p className="clinic-overview-text">{description}</p>}
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

        {otherBranches.length > 0 && (
          <section className="clinic-overview-card" aria-labelledby="clinic-branches-title">
            <h2 id="clinic-branches-title" className="clinic-overview-title">
              Branches
            </h2>
            <dl className="clinic-overview-info">
              {otherBranches.map((branch) => (
                <div key={branch.id} className="clinic-overview-info-row">
                  <Icon name="building" size={18} />
                  <div>
                    <dt>{branch.name}</dt>
                    <dd>
                      {branch.address}
                      {branch.hours && ` · ${branch.hours}`}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
        )}

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
          {mapSrc ? (
            <iframe
              title={`Map of ${name}`}
              className="clinic-overview-map"
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="clinic-overview-map" aria-hidden="true">
              <Icon name="map" size={36} />
            </div>
          )}
          <p className="clinic-overview-address">{address}</p>
          <a href={directionsUrl(clinic)} className="clinic-overview-maps-link" target="_blank" rel="noreferrer">
            Get Directions
            <Icon name="arrowRight" size={14} />
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
          <a href={searchUrl(clinic)} className="clinic-overview-maps-link" target="_blank" rel="noreferrer">
            Open in Maps
            <Icon name="arrowRight" size={14} />
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </section>

        <section className="clinic-overview-card" aria-labelledby="clinic-quick-book-title">
          <h2 id="clinic-quick-book-title" className="clinic-overview-title">
            Quick Book
          </h2>
          <p className="clinic-overview-text">Ready to book your appointment at {name}?</p>
          <a href={bookHref} className="btn btn-primary clinic-overview-book">
            Book Now
          </a>
        </section>
      </div>
    </div>
  );
}

export default ClinicOverview;
