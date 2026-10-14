import Icon from '../Icon';
import StarRating from '../StarRating';
import BookingOption from './BookingOption';

function BookingClinicOption({ clinic, name, isSelected, onSelect }) {
  const { id, name: clinicName, location, rating, accent } = clinic;

  return (
    <BookingOption
      name={name}
      value={id}
      title={clinicName}
      subtitle={
        <>
          <Icon name="mapPin" size={13} />
          {location}
        </>
      }
      media={
        <span className={`booking-option-media booking-option-media--${accent}`}>
          <Icon name="building" size={22} />
        </span>
      }
      aside={
        <span className="booking-option-aside">
          <StarRating rating={rating} size={15} />
        </span>
      }
      isSelected={isSelected}
      onSelect={onSelect}
    />
  );
}

export default BookingClinicOption;
