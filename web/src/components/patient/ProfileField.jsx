import Icon from '../Icon';
import './ProfileField.css';

// Labeled form field for the profile form: a text-type input, or a select
// when `options` is given. `icon` is optional.
function ProfileField({ id, label, icon, options, className = '', ...controlProps }) {
  const controlClass = `profile-field-control${icon ? ' has-icon' : ''}`;

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
          <input id={id} className={controlClass} {...controlProps} />
        )}
      </div>
    </div>
  );
}

export default ProfileField;
