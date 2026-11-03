import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Field, FormError, Modal } from '../portal/PortalUi';
import { confirmAdminPassword, needsPasswordConfirmation } from '../../services/adminApi';

const AdminSecurityContext = createContext(null);

const cancelled = () =>
  Object.assign(new Error('Not done: your password was not confirmed.'), { isCancelled: true });

function PasswordConfirmModal({ onConfirmed, onCancel }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await confirmAdminPassword(password);
      setPassword('');
      onConfirmed();
    } catch (err) {
      setError(err);
      setPassword('');
      setBusy(false);
    }
  };

  return (
    <Modal title="Confirm your password" onClose={onCancel}>
      <form onSubmit={submit}>
        <p className="portal-confirm-message">
          This action changes what clinics or people can do on the platform. Enter your password to continue. You will not be asked
          again for 15 minutes on this device.
        </p>
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={255}
          className="portal-spaced-top"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError error={error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !password}>
            {busy ? 'Checking…' : 'Confirm'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Wraps the admin portal. `runSensitive(action)` runs an API call; when the
 * server answers that the password must be re-entered (423), it asks for the
 * password, confirms it, and runs the call once more. Cancelling rejects with
 * an error whose message says nothing was changed.
 */
export function AdminSecurityProvider({ children }) {
  const [asking, setAsking] = useState(false);
  const pending = useRef(null);

  const askForPassword = () =>
    new Promise((resolve, reject) => {
      pending.current = { resolve, reject };
      setAsking(true);
    });

  const settle = (outcome) => {
    const request = pending.current;
    pending.current = null;
    setAsking(false);
    if (outcome === 'confirmed') request?.resolve();
    else request?.reject(cancelled());
  };

  const runSensitive = useCallback(async (action) => {
    try {
      return await action();
    } catch (error) {
      if (!needsPasswordConfirmation(error)) throw error;
      await askForPassword();
      return action();
    }
  }, []);

  return (
    <AdminSecurityContext.Provider value={runSensitive}>
      {children}
      {asking && <PasswordConfirmModal onConfirmed={() => settle('confirmed')} onCancel={() => settle('cancelled')} />}
    </AdminSecurityContext.Provider>
  );
}

/** `run(() => apiCall())` for actions the server protects with a recent password. */
export function useSensitiveAction() {
  const run = useContext(AdminSecurityContext);
  if (!run) throw new Error('useSensitiveAction must be used inside <AdminSecurityProvider>.');
  return run;
}
