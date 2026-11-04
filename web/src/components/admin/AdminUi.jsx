import { useState } from 'react';
import Icon from '../Icon';
import { Field, FormError, Modal } from '../portal/PortalUi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import './AdminUi.css';

// Building blocks of the system admin design. Colors come from the clinic admin theme.

/** Light pill. tone: success | warning | danger | info | teal | primary | neutral. */
export function StatusTag({ tone = 'neutral', children }) {
  return <span className={`admin-tag is-${tone}`}>{children}</span>;
}

/** Icon, figure, label and note on the dashboard. */
export function StatTile({ icon, tone = 'primary', value, label, note }) {
  return (
    <div className="admin-tile">
      <span className={`admin-tile-icon is-${tone}`} aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <p className="admin-tile-value">{value}</p>
      <p className="admin-tile-label">{label}</p>
      {note && <p className="admin-tile-note">{note}</p>}
    </div>
  );
}

/** Grey labelled box on the detail pages (PLAN, RENEWAL, ...). */
export function DetailTile({ label, value }) {
  return (
    <div className="admin-detail-tile">
      <p className="admin-overline">{label}</p>
      <p className="admin-detail-tile-value">{value}</p>
    </div>
  );
}

/** Numbered progress: finished steps get a green check. */
export function WorkflowSteps({ steps, label }) {
  return (
    <ol className="admin-workflow" aria-label={label}>
      {steps.map((step) => (
        <li key={step.label} className={step.done ? 'is-done' : undefined}>
          <span className="admin-workflow-mark" aria-hidden="true">
            {step.done ? <Icon name="check" size={14} /> : <span className="admin-workflow-dot" />}
          </span>
          {step.label}
          {!step.done && <span className="visually-hidden"> (not yet)</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * The design's question dialog: a sentence, then Confirm and Cancel side by side. With
 * `reasonLabel` it also asks for a reason (required unless `reasonOptional`).
 */
export function ActionDialog({ title, message, confirmLabel = 'Confirm', reasonLabel, reasonOptional = false, reasonHint, isBusy = false, error, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const needsReason = Boolean(reasonLabel) && !reasonOptional;

  return (
    <Modal title={title} onClose={onCancel}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(reason.trim());
        }}
      >
        <p className="portal-confirm-message">{message}</p>
        {reasonLabel && (
          <Field
            label={reasonLabel}
            as="textarea"
            required={needsReason}
            hint={reasonHint}
            className="portal-spaced-top"
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
        <FormError error={error} />
        <div className="admin-dialog-actions">
          <button type="submit" className="btn btn-primary" disabled={isBusy || (needsReason && !reason.trim())}>
            {isBusy ? 'Saving…' : confirmLabel}
          </button>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={isBusy}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Search box in the top bar. */
export function TopbarSearch({ label, placeholder, value, onChange }) {
  return (
    <label className="admin-topbar-search">
      <Icon name="search" size={18} />
      <span className="visually-hidden">{label}</span>
      <input type="search" placeholder={placeholder} value={value} maxLength={100} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

/** Filter dropdown in the top bar. */
export function TopbarSelect({ label, value, options, onChange }) {
  return (
    <label className="admin-topbar-select">
      <span className="visually-hidden">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Search text that only reaches the API once typing pauses. */
export function useSearchText(initial = '') {
  const [text, setText] = useState(initial);
  return { text, setText, search: useDebouncedValue(text.trim()) };
}

export const formatMoney = (amount) => `₱${Number(amount ?? 0).toLocaleString('en-PH')}`;
export const formatMonthly = (amount) => `${formatMoney(amount)}/mo`;

const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'Asia/Manila' });
export const formatMonthYear = (iso) => (iso ? MONTH_YEAR.format(new Date(iso)) : '—');
