import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../Icon';
import AuthField from './AuthField';
import { FORGOT_PASSWORD_HREF } from '../../config/auth';
import { REGISTER_HREF } from '../../config/navigation';
import { DEMO_ACCOUNTS } from '../../config/demoAccounts';
import { login } from '../../services/authService';
import { getErrorMessage } from '../../services/apiErrors';
import { useAuth } from '../../auth/AuthContext';
import { getHomeHref, safeNextPath } from '../../auth/homeRoutes';
import './auth.css';
import './LoginForm.css';

// Signs in through the Laravel API (session cookie). One Sign In button for
// every account type: the account's role (from the API) decides where it
// lands (see auth/homeRoutes.js). ?next=/path returns the user there
// afterwards (same-site paths only; portal guards still apply).
function LoginForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState({ text: '', isError: false });
  const [submitting, setSubmitting] = useState(false);

  const autoFill = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setNotice({ text: `Filled in the ${account.label} demo account. Press Sign In.`, isError: false });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice({ text: '', isError: false });

    try {
      const user = await login({ email, password });
      setUser(user);
      navigate(safeNextPath(searchParams.get('next')) ?? getHomeHref(user), { replace: true });
    } catch (error) {
      setNotice({ text: getErrorMessage(error), isError: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="auth-card" aria-labelledby="login-title" aria-busy={submitting} onSubmit={handleSubmit}>
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

      <button type="submit" className="btn btn-primary login-submit" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign In'}
      </button>

      {DEMO_ACCOUNTS.length > 0 && (
        <section className="login-demo" aria-labelledby="login-demo-title">
          <p id="login-demo-title" className="login-demo-title">
            Auto fill a demo account <span className="login-demo-tag">Development only</span>
          </p>
          <div className="login-demo-list">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="login-demo-chip"
                onClick={() => autoFill(account)}
                aria-label={`Auto fill the ${account.label} demo account`}
              >
                {account.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <p className={`auth-notice${notice.isError ? ' auth-notice--error' : ''}`} role="status">
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
