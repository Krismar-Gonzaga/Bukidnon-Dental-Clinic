import './ProfileInfoCard.css';

// Titled card with label/value rows. rows: [{ label, value }]
// `children` is shown instead of rows when there is nothing to list.
function ProfileInfoCard({ title, subtitle, rows = [], children }) {
  const headingId = `profile-card-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;

  return (
    <section className="profile-info-card" aria-labelledby={headingId}>
      <h2 id={headingId} className="profile-info-card-title">
        {title}
      </h2>
      {subtitle && <p className="profile-info-card-subtitle">{subtitle}</p>}
      {rows.length > 0 ? (
        <dl className="profile-info-card-rows">
          {rows.map(({ label, value }) => (
            <div key={`${label}-${value}`} className="profile-info-card-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        children
      )}
    </section>
  );
}

export default ProfileInfoCard;
