import { useRef, useState } from 'react';
import Icon from '../Icon';
import AuthField from './AuthField';
import { FORGOT_PASSWORD_HREF, SIGN_IN_ROLES } from '../../config/auth';
import { REGISTER_HREF } from '../../config/navigation';
import { login, logout } from '../../services/authService';
import { getErrorMessage } from '../../services/apiErrors';
import { navigateTo } from '../../utils/navigation';
import './auth.css';
import './LoginForm.css';

// Signs in through the Laravel API. The clicked role button must match the
// account's role; on a mismatch the new session is revoked straight away.
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState({ text: '', isError: false });
  const [submitting, setSubmitting] = useState(false);
  // Set by the clicked role button just before the form submits.
  const pendingRoleRef = useRef(SIGN_IN_ROLES[0]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const role = pendingRoleRef.current;
    setSubmitting(true);
    setNotice({ text: '', isError: false });

    try {
      const user = await login({ email, password });

      if (user.role !== role.backendRole) {
        await logout();
        setNotice({
          text: `This account is not a ${role.label} account. Use the sign-in button for your account type.`,
          isError: true,
        });
        return;
      }

      if (role.homeHref) {
        navigateTo(role.homeHref);
        return;
      }
      setNotice({
        text: `Signed in as ${role.label}. The ${role.label} portal is not available on the web yet.`,
        isError: false,
      });
    } catch (error) {
      setNotice({ text: getErrorMessage(error), isError: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="auth-card"
      aria-labelledby="login-title"
      aria-busy={submitting}
      onSubmit={handleSubmit}
    >
      <span className="auth-badge" aria-hidden="true">
        <Icon name="lock" size={28} />
      </span>
      <h1 id="login-title" className="auth-title">
        Welcome Back
      </h1>
      <p className="auth-subtitle">Sign in to your BukidnonDental account</p>

      <AuthField
        id="login-email"
        label="Email Address"
        icon="mail"
        type="email"
        placeholder="juan@example.com"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />

      <AuthField
        id="login-password"
        label="Password"
        icon="lock"
        type="password"
        revealable
        placeholder="Your password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />

      <a href={FORGOT_PASSWORD_HREF} className="login-form-forgot">
        Forgot password?
      </a>

      <div className="login-form-actions">
        {SIGN_IN_ROLES.map((role) => (
          <button
            key={role.id}
            type="submit"
            className={`btn login-role login-role--${role.variant}`}
            disabled={submitting}
            onClick={() => {
              pendingRoleRef.current = role;
            }}
          >
            {role.icon && <Icon name={role.icon} size={17} />}
            Sign In as {role.label}
          </button>
        ))}
      </div>

      <p
        className={`auth-notice${notice.isError ? ' auth-notice--error' : ''}`}
        role="status"
      >
        {notice.text}
      </p>

      <p className="auth-footer">
        Don't have an account?{' '}
        <a href={REGISTER_HREF} className="auth-footer-link">
          Register here
        </a>
      </p>
    </form>
  );
}

export default LoginForm;
