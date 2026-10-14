import Icon from '../Icon';
import './BookingStepper.css';

// steps: [{ id, label }]; currentIndex is zero-based.
// Earlier steps show a check; the line after a finished step turns blue.
function BookingStepper({ steps, currentIndex }) {
  return (
    <ol className="booking-stepper" aria-label="Booking steps">
      {steps.map(({ id, label }, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        const className = [
          'booking-step',
          (isComplete || isCurrent) && 'is-reached',
          isComplete && 'is-complete',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <li
            key={id}
            className={className}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className="booking-step-number">
              {isComplete ? <Icon name="check" size={16} /> : index + 1}
            </span>
            <span className="booking-step-label">
              {label}
              {isComplete && <span className="visually-hidden"> (completed)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default BookingStepper;
