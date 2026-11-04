import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import AuthPageLayout from '../layouts/AuthPageLayout';
import AuthField from '../components/auth/AuthField';
import Icon from '../components/Icon';
import { LOGIN_HREF } from '../config/navigation';
import { requestPasswordReset } from '../services/authService';
import { getErrorMessage } from '../services/apiErrors';
import '../components/auth/auth.css';

// Sends a reset link. The answer is the same whether or not the email has an
// account, so this page cannot be used to discover registered emails.
function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const request = useMutation({ mutationFn: () => requestPasswordReset(email) });

  return (
    <AuthPageLayout>
      <form
        className="auth-card"
        aria-labelledby="forgot-title"
        onSubmit={(event) => {
          event.preventDefault();
          request.mutate();
        }}
      >
        <span className="auth-badge" aria-hidden="true">
          <Icon name="mail" size={28} />
        </span>
        <h1 id="forgot-title" className="auth-title">
          Reset your password
        </h1>
        <p className="auth-subtitle">Enter your account email and we'll send you a reset link.</p>

        {request.isSuccess ? (
          <p className="auth-notice" role="status">
            {request.data}
          </p>
        ) : (
          <>
            <AuthField
              id="forgot-email"
              label="Email Address"
              icon="mail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={request.isPending}>
              {request.isPending ? 'Sending…' : 'Send Reset Link'}
            </button>
            {request.isError && (
              <p className="auth-notice auth-notice--error" role="alert">
                {getErrorMessage(request.error)}
              </p>
            )}
          </>
        )}

        <p className="auth-footer">
          Remembered it?{' '}
          <a href={LOGIN_HREF} className="auth-footer-link">
            Sign in
          </a>
        </p>
      </form>
    </AuthPageLayout>
  );
}

export default ForgotPasswordPage;
