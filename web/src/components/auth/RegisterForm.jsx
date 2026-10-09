import { useState } from 'react';
import Icon from '../Icon';
import AuthField from './AuthField';
import { PRIVACY_HREF, REGISTER_ROLES, TERMS_HREF } from '../../config/auth';
import { LOGIN_HREF } from '../../config/navigation';
import './auth.css';
import './RegisterForm.css';

const INITIAL_VALUES = {
  fullName: '',
  email: '',
  mobile: '',
  password: '',
  confirmPassword: '',
};

const PASSWORD_MISMATCH = 'Passwords do not match.';

// Registration form UI only. Account creation is not integrated yet:
// submitting never sends or stores details, it only shows a notice.
// Both roles use the same fields; the design shows no role-specific fields.
function RegisterForm() {
  const [role, setRole] = useState(REGISTER_ROLES[0].id);
  const [values, setValues] = useState(INITIAL_VALUES);
  const [agreed, setAgreed] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [notice, setNotice] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    if (name === 'password' || name === 'confirmPassword') {
      setPasswordError('');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (values.password !== values.confirmPassword) {
      setPasswordError(PASSWORD_MISMATCH);
      setNotice('');
      return;
    }
    setNotice('Registration is not connected yet. No account was created.');
  };

  return (
    <form
      className="auth-card"
      aria-labelledby="register-title"
      onSubmit={handleSubmit}
    >
      <span className="auth-badge" aria-hidden="true">
        <Icon name="users" size={28} />
      </span>
      <h1 id="register-title" className="auth-title">
        Create Account
      </h1>
      <p className="auth-subtitle">
        Choose your role and fill in your details to get started.
      </p>

      <fieldset className="register-roles">
        <legend className="visually-hidden">Account type</legend>
        {REGISTER_ROLES.map((option) => (
          <label key={option.id} className="register-role">
            <input
              type="radio"
              name="role"
              value={option.id}
              className="register-role-input visually-hidden"
              checked={role === option.id}
              onChange={() => setRole(option.id)}
            />
            <span className="register-role-tile">
              <Icon name={option.icon} size={24} />
              <span className="register-role-label">{option.label}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="register-info">
        <Icon name="info" size={15} className="register-info-icon" />
        Dentists and Clinic Staff are invited by a verified Clinic Administrator
        and cannot self-register.
      </p>

      <AuthField
        id="register-full-name"
        name="fullName"
        label="Full Name"
        icon="user"
        placeholder="Juan Dela Cruz"
        autoComplete="name"
        value={values.fullName}
        onChange={handleChange}
        required
      />

      <AuthField
        id="register-email"
        name="email"
        label="Email Address"
        icon="mail"
        type="email"
        placeholder="juan@example.com"
        autoComplete="email"
        value={values.email}
        onChange={handleChange}
        required
      />

      <AuthField
        id="register-mobile"
        name="mobile"
        label="Mobile Number"
        icon="phone"
        type="tel"
        inputMode="tel"
        placeholder="+63 900 000 0000"
        autoComplete="tel"
        value={values.mobile}
        onChange={handleChange}
        required
      />

      <AuthField
        id="register-password"
        name="password"
        label="Password"
        icon="lock"
        type="password"
        revealable
        placeholder="Create a strong password"
        autoComplete="new-password"
        value={values.password}
        onChange={handleChange}
        required
      />

      <AuthField
        id="register-confirm-password"
        name="confirmPassword"
        label="Confirm Password"
        icon="lock"
        type="password"
        revealable
        placeholder="Repeat your password"
        autoComplete="new-password"
        value={values.confirmPassword}
        onChange={handleChange}
        error={passwordError}
        required
      />

      <label className="register-terms">
        <input
          type="checkbox"
          className="register-terms-checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>
          I agree to the{' '}
          <a href={TERMS_HREF} className="register-terms-link">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href={PRIVACY_HREF} className="register-terms-link">
            Privacy Policy
          </a>
          .
        </span>
      </label>

      <button
        type="submit"
        className="btn btn-primary register-submit"
        disabled={!agreed}
      >
        Create Account
      </button>

      <p className="auth-notice" role="status">
        {notice}
      </p>

      <p className="auth-footer">
        Already have an account?{' '}
        <a href={LOGIN_HREF} className="auth-footer-link">
          Sign in
        </a>
      </p>
    </form>
  );
}

export default RegisterForm;
