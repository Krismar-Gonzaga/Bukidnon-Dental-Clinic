import { forwardRef } from 'react';
import Icon from '../Icon';
import './patientPanel.css';
import './SuccessCard.css';

// Green-check confirmation card. `action` is the button or link below the
// message. The ref goes to the heading so focus can move there.
const SuccessCard = forwardRef(function SuccessCard({ title, message, action }, headingRef) {
  return (
    <section className="patient-panel success-card">
      <Icon name="checkCircle" size={64} className="success-card-icon" />
      <h2 className="success-card-title" ref={headingRef} tabIndex={-1}>
        {title}
      </h2>
      <p className="success-card-message">{message}</p>
      {action}
    </section>
  );
});

export default SuccessCard;
