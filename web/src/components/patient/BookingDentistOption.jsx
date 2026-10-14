import BookingOption from './BookingOption';
import './BookingDentistOption.css';

// TEMPORARY letter tile until dentist photos are available.
const getInitial = (dentistName) =>
  dentistName.replace(/^Dr\.\s*/, '').charAt(0).toUpperCase();

function BookingDentistOption({ dentist, name, isSelected, onSelect }) {
  const { id, name: dentistName, specialty, available, accent } = dentist;

  return (
    <BookingOption
      name={name}
      value={id}
      title={dentistName}
      subtitle={specialty}
      media={
        <span
          className={`booking-option-media booking-option-media--${accent}`}
          aria-hidden="true"
        >
          {getInitial(dentistName)}
        </span>
      }
      aside={
        <span className="booking-option-aside">
          <span
            className={`booking-availability${available ? ' is-available' : ''}`}
          >
            {available ? 'Available' : 'Unavailable'}
          </span>
        </span>
      }
      isSelected={isSelected}
      disabled={!available}
      onSelect={onSelect}
    />
  );
}

export default BookingDentistOption;
