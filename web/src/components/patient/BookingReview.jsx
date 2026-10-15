import Icon from '../Icon';
import './BookingReview.css';

// Summary of the patient's picks. rows: [{ label, value }]
function BookingReview({ rows, notice }) {
  return (
    <>
      <dl className="booking-review">
        {rows.map(({ label, value }) => (
          <div key={label} className="booking-review-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="booking-review-notice">
        <Icon name="info" size={18} />
        {notice}
      </p>
    </>
  );
}

export default BookingReview;
