import Icon from '../Icon';
import './ClinicAvatar.css';

// TEMPORARY gradient tile with a building icon until clinic logos exist.
// size: sm (40px) | md (48px) | lg (80px); accent: 1-6
function ClinicAvatar({ accent = 1, size = 'md' }) {
  const iconSize = { sm: 20, md: 24, lg: 40 }[size];
  return (
    <span
      className={`clinic-avatar clinic-avatar--${size} clinic-avatar--accent-${accent}`}
      aria-hidden="true"
    >
      <Icon name="building" size={iconSize} />
    </span>
  );
}

export default ClinicAvatar;
