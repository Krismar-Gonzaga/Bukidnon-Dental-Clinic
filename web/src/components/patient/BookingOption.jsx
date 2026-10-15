import Icon from '../Icon';
import './BookingOption.css';

// Selectable row shared by the booking steps, built on a native radio input
// for keyboard access. `media` is the leading tile, `aside` the trailing info.
function BookingOption({
  name,
  value,
  title,
  subtitle,
  media,
  aside,
  isSelected,
  disabled = false,
  onSelect,
}) {
  const className = [
    'booking-option',
    isSelected && 'is-selected',
    disabled && 'is-disabled',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={className}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={isSelected}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="visually-hidden"
      />
      {media}
      <span className="booking-option-text">
        <span className="booking-option-title">{title}</span>
        <span className="booking-option-subtitle">{subtitle}</span>
      </span>
      {aside}
      <span className="booking-option-check" aria-hidden="true">
        {isSelected && <Icon name="check" size={18} />}
      </span>
    </label>
  );
}

export default BookingOption;
