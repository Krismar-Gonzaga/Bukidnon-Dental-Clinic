import Icon from '../Icon';
import './ProfileItem.css';

// Row inside a profile card: icon tile, a heading line, detail lines, and an
// optional `aside` (such as a date) on the right. tone: neutral | danger
function ProfileItem({ icon, tone = 'neutral', heading, aside, children }) {
  return (
    <li className={`profile-item profile-item--${tone}`}>
      <span className="profile-item-icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <div className="profile-item-body">
        <div className="profile-item-heading">{heading}</div>
        {children}
      </div>
      {aside && <p className="profile-item-aside">{aside}</p>}
    </li>
  );
}

export default ProfileItem;
