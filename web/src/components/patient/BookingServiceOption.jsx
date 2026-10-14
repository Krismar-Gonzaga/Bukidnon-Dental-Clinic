import Icon from '../Icon';
import './BookingOption.css';
import './BookingServiceOption.css';

// Card-style selectable service; shares selection styles with BookingOption.
function BookingServiceOption({ service, name, isSelected, onSelect }) {
  const { id, name: serviceName, durationLabel, priceLabel } = service;

  return (
    <label
      className={`booking-option booking-service-option${isSelected ? ' is-selected' : ''}`}
    >
      <input
        type="radio"
        name={name}
        value={id}
        checked={isSelected}
        onChange={() => onSelect(id)}
        className="visually-hidden"
      />
      <span className="booking-service-heading">
        <span className="booking-service-name">{serviceName}</span>
        <span className="booking-option-check" aria-hidden="true">
          {isSelected && <Icon name="check" size={18} />}
        </span>
      </span>
      <span className="booking-service-duration">{durationLabel}</span>
      <span className="booking-service-price">{priceLabel}</span>
    </label>
  );
}

export default BookingServiceOption;
