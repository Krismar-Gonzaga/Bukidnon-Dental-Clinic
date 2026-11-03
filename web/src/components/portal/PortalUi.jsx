import { useEffect, useId, useRef } from 'react';
import Icon from '../Icon';
import { getErrorMessage, getFieldErrors } from '../../services/apiErrors';
import './portal.css';

/** Titled card section. */
export function Section({ title, subtitle, actions, children, headingLevel: Heading = 'h2' }) {
  const headingId = useId();
  return (
    <section className="portal-section" aria-labelledby={title ? headingId : undefined}>
      {(title || actions) && (
        <div className="portal-section-header">
          <div>
            {title && (
              <Heading id={headingId} className="portal-section-title">
                {title}
              </Heading>
            )}
            {subtitle && <p className="portal-section-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="portal-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Accessible table. columns: [{ key, label, render?(row) }].
 * Scrolls horizontally on small screens.
 */
export function DataTable({ columns, rows, caption, emptyText = 'Nothing to show yet.', rowKey = (row) => row.id }) {
  if (rows.length === 0) return <p className="portal-empty">{emptyText}</p>;
  return (
    <div className="portal-table-wrap">
      <table className="portal-table">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Labelled input, select (options: [{value,label}] or strings) or textarea. */
export function Field({ label, as = 'input', options, error, hint, className = '', ...props }) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    className: 'portal-field-control',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    ...props,
  };

  let control;
  if (as === 'select') {
    control = (
      <select {...common}>
        {options.map((option) => {
          const value = typeof option === 'object' ? option.value : option;
          const text = typeof option === 'object' ? option.label : option;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
    );
  } else if (as === 'textarea') {
    control = <textarea {...common} />;
  } else {
    control = <input {...common} />;
  }

  return (
    <div className={`portal-field ${className}`.trim()}>
      <label htmlFor={id} className="portal-field-label">
        {label}
      </label>
      {control}
      {hint && (
        <span id={`${id}-hint`} className="portal-field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="portal-field-error">
          {error}
        </span>
      )}
    </div>
  );
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="portal-checkbox">
      <input type="checkbox" {...props} />
      {label}
    </label>
  );
}

const BADGE_TONES = {
  pending: 'warning',
  reschedule_requested: 'warning',
  under_review: 'warning',
  invited: 'warning',
  draft: 'neutral',
  confirmed: 'info',
  checked_in: 'info',
  in_progress: 'info',
  completed: 'success',
  approved: 'success',
  active: 'success',
  resolved: 'success',
  cancelled: 'danger',
  rejected: 'danger',
  no_show: 'danger',
  suspended: 'danger',
  open: 'warning',
};

/** Status label; tone is picked from the status when not given. */
export function Badge({ status, tone, children }) {
  const resolvedTone = tone ?? BADGE_TONES[status] ?? 'neutral';
  return (
    <span className={`portal-badge portal-badge--${resolvedTone}`}>
      {children ?? String(status ?? '').replace(/_/g, ' ')}
    </span>
  );
}

/** API error with any field messages listed. */
export function FormError({ error }) {
  if (!error) return null;
  const fields = Object.values(getFieldErrors(error));
  return (
    <div className="portal-inline-error" role="alert">
      <p>{fields.length > 0 ? 'Please check the following:' : getErrorMessage(error)}</p>
      {fields.length > 0 && (
        <ul>
          {fields.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

/** Dialog with focus trap; Escape or the close button call onClose. */
export function Modal({ title, onClose, children, wide = false }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement;
    dialogRef.current?.querySelector(FOCUSABLE)?.focus();
    return () => opener?.focus?.();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="portal-modal-backdrop">
      <div
        ref={dialogRef}
        className={`portal-modal${wide ? ' portal-modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <div className="portal-modal-header">
          <h2 id={titleId} className="portal-modal-title">
            {title}
          </h2>
          <button type="button" className="portal-modal-close" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** "Are you sure?" dialog for steps that cannot be undone. */
export function ConfirmDialog({ title, message, confirmLabel, danger = false, isBusy = false, error, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="portal-confirm-message">{message}</p>
      <FormError error={error} />
      <div className="portal-form-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={isBusy}>
          Go back
        </button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={isBusy}>
          {isBusy ? 'Saving…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function StatTiles({ stats }) {
  return (
    <dl className="portal-stats">
      {stats.map(({ label, value }) => (
        <div key={label} className="portal-stat">
          <dt className="portal-stat-label">{label}</dt>
          <dd className="portal-stat-value">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
