import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { SegmentedTabs } from '../../components/admin/AdminData';
import { formatMonthly } from '../../components/admin/AdminUi';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import { Card } from '../../components/clinic/ClinicAdminUi';
import { Badge, Field, FormError } from '../../components/portal/PortalUi';
import { ErrorState, LoadingState, QueryState } from '../../components/StatusMessage';
import { ADMIN_SETTINGS_HREF, VERIFICATION_DOCUMENT_LABELS } from '../../config/adminNavigation';
import { getPlatformSettings, getSystemHealth, updatePlatformSettings } from '../../services/adminApi';
import { getFieldErrors } from '../../services/apiErrors';
import { setPlatform } from '../../services/platformStore';
import { formatDateTime } from '../../utils/dateTime';

const TABS = [
  { value: 'platform', label: 'Platform' },
  { value: 'security', label: 'Security' },
  { value: 'verification', label: 'Verification' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'health', label: 'Health' },
];

const CHECK_TONES = { ok: 'success', warn: 'warning', fail: 'danger' };
const CHECK_LABELS = { ok: 'OK', warn: 'Attention', fail: 'Failing' };

function SwitchRow({ label, hint, checked, onChange }) {
  return (
    <label className="admin-switch-row">
      <span>
        <span className="admin-switch-label">{label}</span>
        <span className="admin-switch-hint">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="admin-switch" aria-hidden="true" />
    </label>
  );
}

function PlatformTab({ draft, set, errors }) {
  return (
    <Card title="Platform Information" className="admin-settings-card">
      <div className="admin-form">
        <Field label="Platform Name" required maxLength={80} error={errors.platform_name} value={draft.platform_name} onChange={(e) => set('platform_name', e.target.value)} />
        <Field label="Support Email" type="email" required maxLength={255} error={errors.support_email} value={draft.support_email} onChange={(e) => set('support_email', e.target.value)} />
        <SwitchRow label="Maintenance Mode" hint="Temporarily disable access to the platform" checked={draft.maintenance_mode} onChange={(value) => set('maintenance_mode', value)} />
        <SwitchRow label="Allow Self-Registration" hint="Allow patients to register without admin invitation" checked={draft.allow_self_registration} onChange={(value) => set('allow_self_registration', value)} />
      </div>
    </Card>
  );
}

function SecurityTab({ draft, set, errors }) {
  return (
    <Card title="Security Settings" className="admin-settings-card">
      <div className="admin-form">
        <Field
          label="Session Timeout (minutes)"
          type="number"
          min={5}
          max={1440}
          required
          error={errors.session_timeout_minutes}
          hint="Applies to every web sign-in and to clinic staff and administrators on the app. Patients stay signed in on their phones."
          value={draft.session_timeout_minutes}
          onChange={(e) => set('session_timeout_minutes', e.target.value === '' ? '' : Number(e.target.value))}
        />
        <p className="admin-result-note is-info">
          <Icon name="info" size={18} />
          Password policies are enforced at login. Minimum 8 characters with at least one letter and one number.
        </p>
      </div>
    </Card>
  );
}

function VerificationTab({ draft, set, errors }) {
  const toggleDocument = (type) => {
    const has = draft.required_documents.includes(type);
    set('required_documents', has ? draft.required_documents.filter((item) => item !== type) : [...draft.required_documents, type]);
  };

  return (
    <Card title="Clinic Verification Requirements" className="admin-settings-card">
      <SwitchRow
        label="Require Verification Before Activation"
        hint="New clinics must be verified before they can use the platform"
        checked={draft.require_verification}
        onChange={(value) => set('require_verification', value)}
      />
      <fieldset className="admin-required-documents">
        <legend>Required Documents</legend>
        {draft.document_types.map((type) => {
          const checked = draft.required_documents.includes(type);
          return (
            <label key={type} className={`admin-required-document${checked ? ' is-on' : ''}`}>
              <input type="checkbox" className="visually-hidden" checked={checked} onChange={() => toggleDocument(type)} />
              <Icon name={checked ? 'checkCircle' : 'close'} size={18} />
              {VERIFICATION_DOCUMENT_LABELS[type] ?? type}
            </label>
          );
        })}
      </fieldset>
      {errors.required_documents && <p className="portal-inline-error">{errors.required_documents}</p>}
    </Card>
  );
}

function SubscriptionTab({ draft, set, errors }) {
  return (
    <Card title="Subscription Configuration" className="admin-settings-card">
      <div className="admin-form">
        <Field
          label="Payment Grace Period (days)"
          type="number"
          min={0}
          max={90}
          required
          error={errors.payment_grace_days}
          value={draft.payment_grace_days}
          onChange={(e) => set('payment_grace_days', e.target.value === '' ? '' : Number(e.target.value))}
        />
        <p className="admin-result-note is-warning">
          <Icon name="alertTriangle" size={18} />
          {draft.platform_name} does not process online payments. All payments are handled externally via GCash, Maya, or bank transfer. Clinic admins submit proof of
          payment for manual verification.
        </p>
      </div>
      <h3 className="admin-subheading">Available Plans</h3>
      <ul className="admin-plans">
        {draft.plans.map((plan) => (
          <li key={plan.key}>
            <span>
              <span className="admin-plan-name">{plan.name}</span>
              <span className="admin-plan-limits">{plan.limits}</span>
            </span>
            <span className="admin-plan-price">{formatMonthly(plan.price)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function HealthTab() {
  const health = useQuery({ queryKey: ['admin', 'health'], queryFn: getSystemHealth, staleTime: 60000, retry: false });

  return (
    <Card
      title="Platform Health"
      subtitle={health.data ? `Checked ${formatDateTime(health.data.checked_at)} · ${health.data.environment} environment` : 'Live checks of the services the platform needs.'}
      className="admin-settings-card"
      actions={
        <button type="button" className="btn btn-outline btn-sm" onClick={() => health.refetch()} disabled={health.isFetching}>
          <Icon name="refresh" size={16} />
          {health.isFetching ? 'Checking…' : 'Run Checks Again'}
        </button>
      }
    >
      {health.isPending ? (
        <LoadingState label="Running health checks…" />
      ) : health.isError ? (
        <ErrorState error={health.error} title="Health checks could not run" onRetry={() => health.refetch()} />
      ) : (
        <ul className="admin-breakdown is-tall">
          {health.data.checks.map((check) => (
            <li key={check.key}>
              <span>
                <span className="admin-plan-name">{check.label}</span>
                <span className="admin-plan-limits">{check.detail}</span>
              </span>
              <Badge tone={CHECK_TONES[check.status]}>{CHECK_LABELS[check.status] ?? check.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SaveButton({ draft, onSaving, onSaved, onError }) {
  const runSensitive = useSensitiveAction();
  const save = useMutation({
    mutationFn: () => {
      const values = {
        platform_name: draft.platform_name,
        support_email: draft.support_email,
        maintenance_mode: draft.maintenance_mode,
        allow_self_registration: draft.allow_self_registration,
        session_timeout_minutes: draft.session_timeout_minutes,
        require_verification: draft.require_verification,
        required_documents: draft.required_documents,
        payment_grace_days: draft.payment_grace_days,
      };
      return runSensitive(() => updatePlatformSettings(values));
    },
    onMutate: onSaving,
    onSuccess: onSaved,
    onError,
  });

  return (
    <button type="button" className="btn btn-primary" disabled={!draft || save.isPending} onClick={() => save.mutate()}>
      <Icon name="checkCircle" size={18} />
      {save.isPending ? 'Saving…' : 'Save Settings'}
    </button>
  );
}

function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('platform');
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const query = useQuery({ queryKey: ['admin', 'settings'], queryFn: getPlatformSettings });

  useEffect(() => {
    if (query.data && draft === null) setDraft(query.data);
  }, [query.data, draft]);

  const set = (name, value) => setDraft((current) => ({ ...current, [name]: value }));
  const errors = Object.fromEntries(Object.entries(getFieldErrors(saveError)).map(([key, value]) => [key.split('.')[0], value]));

  return (
    <AdminLayout
      title="System Settings"
      activeHref={ADMIN_SETTINGS_HREF}
      headerActions={
        tab === 'health' ? null : (
          <SaveButton
            draft={draft}
            onSaving={() => {
              setSaved(false);
              setSaveError(null);
            }}
            onError={setSaveError}
            onSaved={(data) => {
              setDraft(data);
              setSaved(true);
              setPlatform({
                platform_name: data.platform_name,
                support_email: data.support_email,
                maintenance_mode: data.maintenance_mode,
                allow_self_registration: data.allow_self_registration,
              });
              queryClient.setQueryData(['admin', 'settings'], data);
            }}
          />
        )
      }
    >
      <div className="admin-tabs-row">
        <SegmentedTabs label="Settings" value={tab} tabs={TABS} onChange={setTab} />
      </div>
      {saved && (
        <p className="portal-success admin-settings-saved" role="status">
          Settings saved.
        </p>
      )}
      <FormError error={saveError} />
      <QueryState query={query} loadingLabel="Loading settings…">
        {() =>
          draft && (
            <>
              {tab === 'platform' && <PlatformTab draft={draft} set={set} errors={errors} />}
              {tab === 'security' && <SecurityTab draft={draft} set={set} errors={errors} />}
              {tab === 'verification' && <VerificationTab draft={draft} set={set} errors={errors} />}
              {tab === 'subscription' && <SubscriptionTab draft={draft} set={set} errors={errors} />}
              {tab === 'health' && <HealthTab />}
            </>
          )
        }
      </QueryState>
    </AdminLayout>
  );
}

export default AdminSettingsPage;
