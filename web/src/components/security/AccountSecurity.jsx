import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../Icon';
import { Card, Toggle } from '../clinic/ClinicAdminUi';
import { ConfirmDialog, Field, FormError, Modal } from '../portal/PortalUi';
import { QueryState } from '../StatusMessage';
import { useAuth } from '../../auth/AuthContext';
import {
  confirmTwoFactor,
  disableTwoFactor,
  fetchCurrentUser,
  getSessions,
  getTwoFactorStatus,
  regenerateRecoveryCodes,
  revokeSession,
  signOutOtherSessions,
  startTwoFactorSetup,
} from '../../services/authService';
import { formatRelative } from '../../utils/dateTime';
import '../clinic/ClinicAdminUi.css';
import './AccountSecurity.css';

const TWO_FACTOR_KEY = ['account', 'two-factor'];
const SESSIONS_KEY = ['account', 'sessions'];

function RecoveryCodes({ codes, onDone }) {
  return (
    <>
      <p className="clinic-warning-note">
        <Icon name="alertTriangle" size={16} />
        Save these recovery codes somewhere safe. Each one works once if you lose your authenticator app, and they are shown only now.
      </p>
      <ul className="clinic-recovery-codes">
        {codes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="portal-form-actions">
        <button type="button" className="btn btn-primary" onClick={onDone}>
          I saved them
        </button>
      </div>
    </>
  );
}

function SetupModal({ onClose, onEnabled }) {
  const [step, setStep] = useState('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const start = useMutation({
    mutationFn: () => startTwoFactorSetup(password),
    onSuccess: (data) => {
      setPassword('');
      setSetup(data);
      setStep('code');
    },
  });
  const confirm = useMutation({
    mutationFn: () => confirmTwoFactor(code.trim()),
    onSuccess: (data) => {
      setRecoveryCodes(data.recovery_codes ?? []);
      setStep('codes');
      onEnabled();
    },
  });

  return (
    <Modal title="Set Up Two-Factor Authentication" onClose={onClose}>
      {step === 'password' && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            start.mutate();
          }}
        >
          <Field label="Confirm your password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <FormError error={start.error} />
          <div className="portal-form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={start.isPending}>
              {start.isPending ? 'Checking…' : 'Continue'}
            </button>
          </div>
        </form>
      )}
      {step === 'code' && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            confirm.mutate();
          }}
        >
          <p className="portal-confirm-message">Scan this code with your authenticator app (Google Authenticator, Microsoft Authenticator or similar), then enter the 6-digit code it shows.</p>
          {setup.qr_svg && <img className="account-security-qr" alt="QR code for your authenticator app" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qr_svg)}`} />}
          <p className="clinic-file-meta">Or type this key in:</p>
          <code className="clinic-secret">{setup.secret}</code>
          <p className="clinic-file-meta">
            <a href={setup.otpauth_url}>Open in an authenticator app on this device</a>
          </p>
          <div className="clinic-form-gap">
            <Field label="6-digit code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} />
          </div>
          <FormError error={confirm.error} />
          <div className="portal-form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!code.trim() || confirm.isPending}>
              {confirm.isPending ? 'Checking…' : 'Enable 2FA'}
            </button>
          </div>
        </form>
      )}
      {step === 'codes' && <RecoveryCodes codes={recoveryCodes} onDone={onClose} />}
    </Modal>
  );
}

function DisableModal({ onClose, onDisabled }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const disable = useMutation({
    mutationFn: () => disableTwoFactor(password, code.trim()),
    onSuccess: () => {
      onDisabled();
      onClose();
    },
  });
  return (
    <Modal title="Turn Off Two-Factor Authentication" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          disable.mutate();
        }}
      >
        <p className="portal-confirm-message">Your account will be protected by your password only.</p>
        <Field label="Confirm your password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <Field label="Code from your app, or a recovery code" required autoComplete="one-time-code" maxLength={20} value={code} onChange={(event) => setCode(event.target.value)} />
        <FormError error={disable.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={!code.trim() || disable.isPending}>
            {disable.isPending ? 'Turning off…' : 'Turn Off'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NewCodesModal({ onClose, onDone }) {
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState(null);
  const create = useMutation({
    mutationFn: () => regenerateRecoveryCodes(password),
    onSuccess: (data) => {
      setCodes(data.recovery_codes ?? []);
      onDone();
    },
  });
  return (
    <Modal title="New Recovery Codes" onClose={onClose}>
      {codes ? (
        <RecoveryCodes codes={codes} onDone={onClose} />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <p className="portal-confirm-message">Your old recovery codes will stop working.</p>
          <Field label="Confirm your password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <FormError error={create.error} />
          <div className="portal-form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create New Codes'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Turn two-factor sign-in on or off, for any kind of account. */
export function TwoFactorCard() {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const enabled = Boolean(user?.two_factor_enabled);
  const status = useQuery({ queryKey: TWO_FACTOR_KEY, queryFn: getTwoFactorStatus, enabled });

  const refresh = async () => {
    const fresh = await fetchCurrentUser();
    if (fresh) setUser(fresh);
    queryClient.invalidateQueries({ queryKey: TWO_FACTOR_KEY });
    queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
  };

  return (
    <Card>
      <Toggle
        label={<strong className="clinic-admin-card-title">Two-Factor Authentication</strong>}
        hint="Add an extra layer of security to your account using an authenticator app."
        checked={enabled}
        onChange={(value) => setModal(value ? 'setup' : 'disable')}
      />
      {enabled && (
        <>
          <p className="clinic-saved-note clinic-form-gap is-navy">
            <Icon name="shieldCheck" size={16} />
            2FA is enabled. Your account is protected.
          </p>
          <div className="account-security-codes">
            <span className="clinic-file-meta">{status.data ? `${status.data.recovery_codes_left} recovery codes left` : ''}</span>
            <button type="button" className="clinic-link-button" onClick={() => setModal('codes')}>
              Create new recovery codes
            </button>
          </div>
        </>
      )}
      {modal === 'setup' && <SetupModal onClose={() => setModal(null)} onEnabled={refresh} />}
      {modal === 'disable' && <DisableModal onClose={() => setModal(null)} onDisabled={refresh} />}
      {modal === 'codes' && <NewCodesModal onClose={() => setModal(null)} onDone={refresh} />}
    </Card>
  );
}

function SignOutOthersModal({ onClose, onDone }) {
  const [password, setPassword] = useState('');
  const run = useMutation({
    mutationFn: () => signOutOtherSessions(password),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Modal title="Sign Out of Other Devices" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run.mutate();
        }}
      >
        <p className="portal-confirm-message">Every device except this one will need to sign in again.</p>
        <Field label="Confirm your password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <FormError error={run.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={run.isPending}>
            {run.isPending ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Where this account is signed in, and a way to end any of it. */
export function SessionsCard() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SESSIONS_KEY, queryFn: getSessions });
  const [asking, setAsking] = useState(null);
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
  const revoke = useMutation({
    mutationFn: (id) => revokeSession(id),
    onSuccess: () => {
      refresh();
      setAsking(null);
    },
  });
  const hasOthers = (query.data ?? []).some((session) => !session.current);

  return (
    <Card
      title="Signed-in Devices"
      subtitle="Sign out of anything you do not recognize, then change your password."
      actions={
        hasOthers && (
          <button type="button" className="clinic-link-button" onClick={() => setIsSigningOutOthers(true)}>
            Sign out of all others
          </button>
        )
      }
    >
      <QueryState query={query} loadingLabel="Loading your devices…">
        {(sessions) => (
          <ul className="account-security-sessions">
            {sessions.map((session) => (
              <li key={session.id} className="account-security-session">
                <span className="clinic-tile-icon is-blue" aria-hidden="true">
                  <Icon name={session.type === 'app' ? 'phone' : 'layoutGrid'} size={18} />
                </span>
                <div className="account-security-session-body">
                  <p className="account-security-session-name">
                    {session.device}
                    {session.current && <span className="clinic-pill is-info">This device</span>}
                  </p>
                  <p className="clinic-file-meta">
                    {[session.type === 'app' ? 'Mobile app' : 'Web browser', session.ip_address, `Active ${formatRelative(session.last_active_at)}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {!session.current && (
                  <button type="button" className="clinic-link-button" aria-label={`Sign out of ${session.device}`} onClick={() => setAsking(session)}>
                    Sign out
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      {asking && (
        <ConfirmDialog
          title="Sign out of this device?"
          message={`${asking.device} will need to sign in again.`}
          confirmLabel="Sign out"
          danger
          isBusy={revoke.isPending}
          error={revoke.error}
          onConfirm={() => revoke.mutate(asking.id)}
          onCancel={() => setAsking(null)}
        />
      )}
      {isSigningOutOthers && <SignOutOthersModal onClose={() => setIsSigningOutOthers(false)} onDone={refresh} />}
    </Card>
  );
}

/** Both cards, for the security page of each kind of account. */
export function AccountSecurity() {
  return (
    <div className="account-security">
      <TwoFactorCard />
      <SessionsCard />
    </div>
  );
}
