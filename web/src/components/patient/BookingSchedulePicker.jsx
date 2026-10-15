import {
  formatFullDate,
  formatMonthYear,
  getMondayFirstWeekday,
  toDateKey,
} from '../../utils/bookingCalendar';
import './BookingSchedulePicker.css';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// Date grid and time slots, both native radio groups for keyboard access.
// dates: consecutive available Date objects within one month.
// dateLabelPrefix (optional) is shown before the month, e.g. 'Select New Date'.
function BookingSchedulePicker({
  dates,
  timeSlots,
  selectedDateKey,
  selectedTime,
  onDateSelect,
  onTimeSelect,
  dateLabelPrefix,
  timeLabel = 'Available Time Slots',
}) {
  const leadingBlanks = getMondayFirstWeekday(dates[0]);

  return (
    <div className="booking-schedule">
      <h3 id="booking-schedule-month" className="booking-schedule-label">
        {dateLabelPrefix
          ? `${dateLabelPrefix} — ${formatMonthYear(dates[0])}`
          : formatMonthYear(dates[0])}
      </h3>
      <div className="booking-calendar" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="booking-calendar-weekday">
            {label}
          </span>
        ))}
      </div>
      <div
        role="radiogroup"
        aria-labelledby="booking-schedule-month"
        className="booking-calendar"
      >
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}
        {dates.map((date) => {
          const key = toDateKey(date);
          const isSelected = key === selectedDateKey;
          return (
            <label
              key={key}
              className={`booking-calendar-day${isSelected ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="date"
                value={key}
                checked={isSelected}
                onChange={() => onDateSelect(key)}
                className="visually-hidden"
              />
              <span aria-hidden="true">{date.getDate()}</span>
              <span className="visually-hidden">{formatFullDate(date)}</span>
            </label>
          );
        })}
      </div>

      <h3 id="booking-schedule-times" className="booking-schedule-label">
        {timeLabel}
      </h3>
      <div
        role="radiogroup"
        aria-labelledby="booking-schedule-times"
        className="booking-time-slots"
      >
        {timeSlots.map((time) => {
          const isSelected = time === selectedTime;
          return (
            <label
              key={time}
              className={`booking-time-slot${isSelected ? ' is-selected' : ''}`}
            >
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
    </div>
  );
}

export default BookingSchedulePicker;
