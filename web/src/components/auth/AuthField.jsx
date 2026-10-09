import { useState } from 'react';
import Icon from '../Icon';

// Labeled input with a leading icon, used by the auth forms.
// `revealable` adds a show/hide toggle for password fields.
function AuthField({
  id,
  label,
  icon,
  type = 'text',
  revealable = false,
  error,
  ...inputProps
}) {
  const [revealed, setRevealed] = useState(false);
  const errorId = error ? `${id}-error` : undefined;
  const inputType = revealable && revealed ? 'text' : type;

  return (
    <div className="auth-field">
      <label htmlFor={id} className="auth-label">
        {label}
      </label>
      <div className="auth-control">
        <Icon name={icon} size={16} className="auth-icon" />
        <input
          id={id}
          type={inputType}
          className={`auth-input${revealable ? ' auth-input--with-toggle' : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...inputProps}
        />
        {revealable && (
          <button
            type="button"
            className="auth-toggle"
            aria-label={`${revealed ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            aria-pressed={revealed}
            aria-controls={id}
            onClick={() => setRevealed((visible) => !visible)}
          >
            <Icon name={revealed ? 'eyeOff' : 'eye'} size={16} />
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="auth-error">
          {error}
        </p>
      )}
    </div>
  );
}

export default AuthField;
