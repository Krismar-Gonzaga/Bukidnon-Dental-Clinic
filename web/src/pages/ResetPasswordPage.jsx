import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import AuthPageLayout from '../layouts/AuthPageLayout';
import AuthField from '../components/auth/AuthField';
import Icon from '../components/Icon';
import { FORGOT_PASSWORD_HREF, LOGIN_HREF } from '../config/navigation';
import { getPasswordRuleError } from '../utils/passwordStrength';
import { resetPassword } from '../services/authService';
import { getErrorMessage } from '../services/apiErrors';
import '../components/auth/auth.css';

// Opened from the reset email: /reset-password?token=…&email=…
// Also used by newly invited clinic staff to set their first password.
function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  const reset = useMutation({ mutationFn: () => resetPassword({ token, email, password }) });

  const handleSubmit = (event) => {
    event.preventDefault();
    const ruleError = getPasswordRuleError(password);
    if (ruleError) {
      setLocalError(ruleError);
      return;
    }
    if (password !== confirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    setLocalError('');
    reset.mutate();
  };

  const isLinkMissing = !token || !email;

  return (
    <AuthPageLayout>
      <form className="auth-card" aria-labelledby="reset-title" onSubmit={handleSubmit} noValidate>
        <span className="auth-badge" aria-hidden="true">
          <Icon name="lock" size={28} />
        </span>
        <h1 id="reset-title" className="auth-title">
          Choose a new password
        </h1>

        {isLinkMissing ? (
          <p className="auth-notice auth-notice--error" role="alert">
            This link is incomplete. <a href={FORGOT_PASSWORD_HREF}>Request a new reset link</a>.
          </p>
        ) : reset.isSuccess ? (
          <p className="auth-notice" role="status">
            {reset.data} <a href={LOGIN_HREF}>Sign in</a>
          </p>
        ) : (
          <>
            <p className="auth-subtitle">For {email}</p>
            <AuthField
              id="reset-password"
              label="New Password"
              icon="lock"
              type="password"
              revealable
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <AuthField
              id="reset-confirm"
              label="Confirm Password"
              icon="lock"
              type="password"
              revealable
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={reset.isPending}>
              {reset.isPending ? 'Saving…' : 'Save Password'}
            </button>
            {(localError || reset.isError) && (
              <p className="auth-notice auth-notice--error" role="alert">
                {localError || getErrorMessage(reset.error)}
              </p>
            )}
          </>
        )}
      </form>
    </AuthPageLayout>
  );
}

export default ResetPasswordPage;
