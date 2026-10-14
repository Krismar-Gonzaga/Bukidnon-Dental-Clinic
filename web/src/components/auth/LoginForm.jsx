import { useRef, useState } from 'react';
import Icon from '../Icon';
import AuthField from './AuthField';
import { FORGOT_PASSWORD_HREF, SIGN_IN_ROLES } from '../../config/auth';
import { REGISTER_HREF } from '../../config/navigation';
import './auth.css';
import './LoginForm.css';

// Login form UI only. Authentication is not integrated yet: submitting never
// sends or stores credentials, it only shows a notice for the chosen role.
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  // Set by the clicked role button just before the form submits.
  const pendingRoleRef = useRef(SIGN_IN_ROLES[0]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setNotice(
      `${pendingRoleRef.current.label} sign-in is not connected yet. You have not been signed in.`
    );
  };

  return (
    <form
      className="auth-card"
      aria-labelledby="login-title"
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
            onClick={() => {
              pendingRoleRef.current = role;
            }}
          >
            {role.icon && <Icon name={role.icon} size={17} />}
            Sign In as {role.label}
          </button>
        ))}
      </div>

      <p className="auth-notice" role="status">
        {notice}
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
