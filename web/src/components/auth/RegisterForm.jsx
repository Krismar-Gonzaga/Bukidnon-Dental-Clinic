import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../Icon';
import AuthField from './AuthField';
import { PRIVACY_HREF, REGISTER_ROLES, TERMS_HREF } from '../../config/auth';
import { LOGIN_HREF } from '../../config/navigation';
import { register } from '../../services/authService';
import { getErrorMessage, getFieldErrors } from '../../services/apiErrors';
import { usePlatform } from '../../services/platformStore';
import { useAuth } from '../../auth/AuthContext';
import { getHomeHref } from '../../auth/homeRoutes';
import { getPasswordRuleError } from '../../utils/passwordStrength';
import './auth.css';
import './RegisterForm.css';

const INITIAL_VALUES = {
  fullName: '',
  email: '',
  mobile: '',
  address: '',
  password: '',
  confirmPassword: '',
};

// Backend validation field -> form field.
const BACKEND_FIELDS = {
  name: 'fullName',
  email: 'email',
  phone: 'mobile',
  address: 'address',
  password: 'password',
};

const PASSWORD_MISMATCH = 'Passwords do not match.';

const toFormErrors = (backendErrors) =>
  Object.fromEntries(
    Object.entries(backendErrors)
      .filter(([field]) => BACKEND_FIELDS[field])
      .map(([field, message]) => [BACKEND_FIELDS[field], message])
  );

// Creates an account through the Laravel API and signs the new user in.
// Both roles use the same fields; the design shows no role-specific fields.
// Address is not in the Figma design but is required by POST /register.
function RegisterForm() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [role, setRole] = useState(REGISTER_ROLES[0].id);
  const { allow_self_registration: patientsMayRegister } = usePlatform();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [agreed, setAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState({ text: '', isError: false });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      const { [name]: _cleared, ...rest } = current;
      if (name === 'password') {
        delete rest.confirmPassword;
      }
      return rest;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice({ text: '', isError: false });
    const passwordError = getPasswordRuleError(values.password);
    if (passwordError) {
      setFieldErrors({ password: passwordError });
      return;
    }
    if (values.password !== values.confirmPassword) {
      setFieldErrors({ confirmPassword: PASSWORD_MISMATCH });
      return;
    }

    const selectedRole = REGISTER_ROLES.find((option) => option.id === role);
    setSubmitting(true);
    setFieldErrors({});

    try {
      const user = await register({
        name: values.fullName,
        email: values.email,
        phone: values.mobile,
        address: values.address,
        password: values.password,
        role: selectedRole.backendRole,
      });

      // Patients go to their dashboard; clinic admins to the clinic application.
      setUser(user);
      navigate(getHomeHref(user), { replace: true });
    } catch (error) {
      const formErrors = toFormErrors(getFieldErrors(error));
      setFieldErrors(formErrors);
      setNotice({
        text:
          Object.keys(formErrors).length > 0
            ? 'Please correct the highlighted fields.'
            : getErrorMessage(error),
        isError: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // The server refuses it too; this says so before anyone fills in the form.
  const registrationClosed = !patientsMayRegister && REGISTER_ROLES.find((option) => option.id === role)?.backendRole === 'patient';

  return (
    <form
      className="auth-card"
      aria-labelledby="register-title"
      aria-busy={submitting}
      onSubmit={handleSubmit}
    >
      {registrationClosed && (
        <p className="auth-error" role="status">
          Patient registration is closed right now. Please ask your clinic for an invitation.
        </p>
      )}
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
        error={fieldErrors.fullName}
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
        error={fieldErrors.email}
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
        error={fieldErrors.mobile}
        required
      />

      <AuthField
        id="register-address"
        name="address"
        label="Address"
        icon="mapPin"
        placeholder="Street, Barangay, City"
        autoComplete="street-address"
        value={values.address}
        onChange={handleChange}
        error={fieldErrors.address}
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
        error={fieldErrors.password}
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
        error={fieldErrors.confirmPassword}
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
        disabled={!agreed || submitting || registrationClosed}
      >
        Create Account
      </button>

      <p
        className={`auth-notice${notice.isError ? ' auth-notice--error' : ''}`}
        role="status"
      >
        {notice.text}
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
