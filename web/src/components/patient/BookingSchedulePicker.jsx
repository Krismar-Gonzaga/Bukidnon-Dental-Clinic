import {
  formatFullDate,
  formatMonthYear,
  getMondayFirstWeekday,
  toDateKey,
} from '../../utils/bookingCalendar';
import './BookingSchedulePicker.css';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const rangeLabel = (dates) => {
  const first = formatMonthYear(dates[0]);
  const last = formatMonthYear(dates[dates.length - 1]);
  return first === last ? first : `${first} – ${last}`;
};

// Date grid and time slots, both native radio groups for keyboard access.
// dates: consecutive Date objects. isDateOpen(date) disables days without
// availability. Time slots come from the availability API for the chosen day.
// dateLabelPrefix (optional) is shown before the month, e.g. 'Select New Date'.
function BookingSchedulePicker({
  dates,
  isDateOpen = () => true,
  timeSlots,
  selectedDateKey,
  selectedTime,
  onDateSelect,
  onTimeSelect,
  isLoadingSlots = false,
  slotsMessage,
  dateLabelPrefix,
  timeLabel = 'Available Time Slots',
}) {
  const leadingBlanks = getMondayFirstWeekday(dates[0]);

  const renderSlots = () => {
    if (!selectedDateKey) {
      return <p className="booking-schedule-hint">Choose a date to see open times.</p>;
    }
    if (isLoadingSlots) {
      return <p className="booking-schedule-hint" role="status">Checking open times…</p>;
    }
    if (slotsMessage) {
      return <p className="booking-schedule-hint" role="status">{slotsMessage}</p>;
    }
    if (timeSlots.length === 0) {
      return (
        <p className="booking-schedule-hint" role="status">
          No open times on this date. Please choose another day.
        </p>
      );
    }
    return (
      <div role="radiogroup" aria-labelledby="booking-schedule-times" className="booking-time-slots">
        {timeSlots.map((time) => {
          const isSelected = time === selectedTime;
          return (
            <label key={time} className={`booking-time-slot${isSelected ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="time"
                value={time}
                checked={isSelected}
                onChange={() => onTimeSelect(time)}
                className="visually-hidden"
              />
              {time}
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <div className="booking-schedule">
      <h3 id="booking-schedule-month" className="booking-schedule-label">
        {dateLabelPrefix ? `${dateLabelPrefix} — ${rangeLabel(dates)}` : rangeLabel(dates)}
      </h3>
      <div className="booking-calendar" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="booking-calendar-weekday">
            {label}
          </span>
        ))}
      </div>
      <div role="radiogroup" aria-labelledby="booking-schedule-month" className="booking-calendar">
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}
        {dates.map((date) => {
          const key = toDateKey(date);
          const isSelected = key === selectedDateKey;
          const isOpen = isDateOpen(date);
          return (
            <label
              key={key}
              className={`booking-calendar-day${isSelected ? ' is-selected' : ''}${isOpen ? '' : ' is-disabled'}`}
            >
              <input
                type="radio"
                name="date"
                value={key}
                checked={isSelected}
                disabled={!isOpen}
                onChange={() => onDateSelect(key)}
                className="visually-hidden"
              />
              <span aria-hidden="true">{date.getDate()}</span>
              <span className="visually-hidden">
                {formatFullDate(date)}
                {isOpen ? '' : ' (unavailable)'}
              </span>
            </label>
          );
        })}
      </div>

      <h3 id="booking-schedule-times" className="booking-schedule-label">
        {timeLabel}
      </h3>
      {renderSlots()}
    </div>
  );
}

export default BookingSchedulePicker;
