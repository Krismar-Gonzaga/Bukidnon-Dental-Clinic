import './ProfileDetailTile.css';

// Label/value tile used in the profile's medical tabs.
// tone: neutral | warning | normal. `children` adds content under the value.
function ProfileDetailTile({ label, value, note, tone = 'neutral', className = '', children }) {
  return (
    <div className={`profile-detail-tile profile-detail-tile--${tone} ${className}`.trim()}>
      <dt className="profile-detail-tile-label">{label}</dt>
      <dd className="profile-detail-tile-value">
        {value}
        {note && <span className="profile-detail-tile-note">{note}</span>}
        {children}
      </dd>
    </div>
  );
}

export default ProfileDetailTile;
