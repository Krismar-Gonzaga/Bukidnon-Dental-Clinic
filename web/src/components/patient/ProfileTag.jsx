import './ProfileTag.css';

// Small rounded chip used on the profile. tone: danger | warning | success | neutral
function ProfileTag({ tone = 'neutral', children }) {
  return <span className={`profile-tag profile-tag--${tone}`}>{children}</span>;
}

export default ProfileTag;
