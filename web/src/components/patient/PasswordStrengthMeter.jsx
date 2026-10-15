import { getPasswordStrength, PASSWORD_STRENGTH_SEGMENTS } from '../../utils/passwordStrength';
import './PasswordStrengthMeter.css';

const SEGMENTS = Array.from({ length: PASSWORD_STRENGTH_SEGMENTS }, (_, index) => index);

// Segmented strength bar with a label and hint. `id` lets the password input
// reference the text through aria-describedby.
function PasswordStrengthMeter({ id, password }) {
  const { score, label, level, hint } = getPasswordStrength(password);

  return (
    <div className={`password-strength password-strength--${level}`}>
      <p className="password-strength-title">Password strength</p>
      <div className="password-strength-bar" aria-hidden="true">
        {SEGMENTS.map((index) => (
          <span
            key={index}
            className={`password-strength-segment${index < score ? ' is-filled' : ''}`}
          />
        ))}
      </div>
      <p id={id} className="password-strength-text" aria-live="polite">
        {password ? `${label}${hint ? ` — ${hint}` : ''}` : ''}
      </p>
    </div>
  );
}

export default PasswordStrengthMeter;
