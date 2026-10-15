import Icon from '../Icon';
import './ProfileInfoCard.css';

// Titled profile card. `editHref` adds an Edit link in the header.
// `children` is the card body; `rows` ([{ label, value }]) are listed after it.
function ProfileInfoCard({ title, subtitle, editHref, rows = [], children }) {
  const headingId = `profile-card-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;

  return (
    <section className="profile-info-card" aria-labelledby={headingId}>
      <div className="profile-info-card-header">
        <div>
          <h2 id={headingId} className="profile-info-card-title">
            {title}
          </h2>
          {subtitle && <p className="profile-info-card-subtitle">{subtitle}</p>}
        </div>
        {editHref && (
          <a href={editHref} className="profile-info-card-edit" aria-label={`Edit ${title}`}>
            <Icon name="pencil" size={14} />
            Edit
          </a>
        )}
      </div>
      {children}
      {rows.length > 0 && (
        <dl className="profile-info-card-rows">
          {rows.map(({ label, value }) => (
            <div key={`${label}-${value}`} className="profile-info-card-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export default ProfileInfoCard;
