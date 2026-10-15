import { useState } from 'react';
import Icon from '../Icon';
import './ProfileField.css';

// Labeled form field for the profile form: a text-type input, or a select
// when `options` is given. `icon` is optional. `revealable` adds a show/hide
// toggle for password fields.
function ProfileField({
  id,
  label,
  icon,
  options,
  revealable = false,
  type,
  className = '',
  ...controlProps
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const controlClass = `profile-field-control${icon ? ' has-icon' : ''}${
    revealable ? ' has-toggle' : ''
  }`;

  return (
    <div className={`profile-field ${className}`.trim()}>
      <label htmlFor={id} className="profile-field-label">
        {label}
      </label>
      <div className="profile-field-wrap">
        {icon && <Icon name={icon} size={16} className="profile-field-icon" />}
        {options ? (
          <>
            <select id={id} className={`${controlClass} profile-field-select`} {...controlProps}>
              <option value="">Select…</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={16} className="profile-field-chevron" />
          </>
        ) : (
          <input
            id={id}
            type={revealable && isRevealed ? 'text' : type}
            className={controlClass}
            {...controlProps}
          />
        )}
        {revealable && (
          <button
            type="button"
            className="profile-field-toggle"
            aria-label={`${isRevealed ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            aria-pressed={isRevealed}
            aria-controls={id}
            onClick={() => setIsRevealed((revealed) => !revealed)}
          >
            <Icon name={isRevealed ? 'eyeOff' : 'eye'} size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export default ProfileField;
