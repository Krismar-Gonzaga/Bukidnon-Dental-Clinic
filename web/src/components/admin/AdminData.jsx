import { useId } from 'react';
import Icon from '../Icon';
import '../Pagination.css';
import './AdminData.css';

// Building blocks of the admin data pages (Verification, Audit Logs).

/** Page title, description and page actions (AdminLayout renders no title for these pages). */
export function PageHeader({ title, lead, children }) {
  return (
    <div className="admin-page-head">
      <div>
        <h1 className="admin-page-heading">{title}</h1>
        {lead && <p className="admin-page-lead">{lead}</p>}
      </div>
      {children && <div className="admin-page-actions">{children}</div>}
    </div>
  );
}

/** Summary figure with an overline label and a short note under it. */
export function MetricCard({ label, value, tone = 'default', note, noteIcon, noteTone = 'muted' }) {
  return (
    <div className="admin-metric">
      <p className="admin-overline">{label}</p>
      <p className={`admin-metric-value is-${tone}`}>{value}</p>
      {note && (
        <p className={`admin-metric-note is-${noteTone}`}>
          {noteIcon && <Icon name={noteIcon} size={14} />}
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}

/** Rounded status label with a leading dot. tone: success | primary | warning | danger | neutral. */
export function StatusPill({ tone = 'neutral', children }) {
  return (
    <span className={`admin-pill is-${tone}`}>
      <span className="admin-pill-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Initials avatar for a person or clinic name. */
export function Initials({ name, tone = 'primary', square = false }) {
  const letters =
    String(name ?? '')
      .split(/\s+/)
      .filter((word) => /^[\p{L}\p{N}]/u.test(word))
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('') || '?';
  return (
    <span className={`admin-initials is-${tone}${square ? ' is-square' : ''}`} aria-hidden="true">
      {letters}
    </span>
  );
}

/** First page, last page and the pages next to the current one; gaps become "…". */
export function pageWindow(current, last) {
  const pages = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((page, index) => (index > 0 && page - sorted[index - 1] > 1 ? ['gap', page] : [page]));
}

/** "Showing 1–10 of 128 results", rows per page and compact page buttons. */
export function TableFooter({ meta, onPageChange, perPage, onPerPageChange, noun = 'results', label }) {
  const selectId = useId();
  const total = meta?.total ?? 0;
  const current = meta?.current_page ?? 1;
  const last = meta?.last_page ?? 1;
  const first = total === 0 ? 0 : (current - 1) * (meta?.per_page ?? perPage) + 1;
  const lastShown = Math.min(total, first + (meta?.per_page ?? perPage) - 1);

  return (
    <div className="admin-table-footer">
      <p className="admin-table-count">
        {total === 0 ? `No ${noun}` : `Showing ${first.toLocaleString()}–${lastShown.toLocaleString()} of ${total.toLocaleString()} ${noun}`}
      </p>
      <div className="admin-table-footer-controls">
        {onPerPageChange && (
          <label className="admin-per-page" htmlFor={selectId}>
            Rows per page:
            <select id={selectId} value={perPage} onChange={(e) => onPerPageChange(Number(e.target.value))}>
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {last > 1 && (
          <nav className="pagination" aria-label={label}>
            <button type="button" className="pagination-button" aria-label="Previous page" disabled={current === 1} onClick={() => onPageChange(current - 1)}>
              <Icon name="chevronLeft" size={16} />
            </button>
            <ul className="pagination-list">
              {pageWindow(current, last).map((page, index) =>
                page === 'gap' ? (
                  <li key={`gap-${index}`} className="admin-page-gap" aria-hidden="true">
                    …
                  </li>
                ) : (
                  <li key={page}>
                    <button
                      type="button"
                      className={`pagination-button${page === current ? ' is-current' : ''}`}
                      aria-label={`Page ${page}`}
                      aria-current={page === current ? 'page' : undefined}
                      onClick={() => onPageChange(page)}
                    >
                      {page}
                    </button>
                  </li>
                )
              )}
            </ul>
            <button type="button" className="pagination-button" aria-label="Next page" disabled={current === last} onClick={() => onPageChange(current + 1)}>
              <Icon name="chevronRight" size={16} />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

/** Segmented tabs (design: "All Clinics | Expiring Soon"). */
export function SegmentedTabs({ tabs, value, onChange, label }) {
  return (
    <div className="admin-segmented" role="group" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          aria-pressed={tab.value === value}
          className={`admin-segmented-tab${tab.value === value ? ' is-active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count != null && <span className="admin-segmented-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
