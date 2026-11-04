import Icon from './Icon';
import { getErrorMessage } from '../services/apiErrors';
import './StatusMessage.css';

// Shared loading, error and empty states for API-backed screens.

export function LoadingState({ label = 'Loading…', fullPage = false }) {
  return (
    <div className={`status-message status-message--loading${fullPage ? ' is-full-page' : ''}`} role="status">
      <span className="status-message-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, title = 'Something went wrong', onRetry }) {
  const isNotFound = error?.response?.status === 404;

  return (
    <div className="status-message status-message--error" role="alert">
      <Icon name="alertCircle" size={22} />
      <div>
        <p className="status-message-title">{isNotFound ? 'Not found' : title}</p>
        <p className="status-message-text">
          {isNotFound ? 'This item does not exist or you do not have access to it.' : getErrorMessage(error)}
        </p>
        {onRetry && !isNotFound && (
          <button type="button" className="btn btn-outline btn-sm status-message-retry" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'info', title, children, action }) {
  return (
    <div className="status-message status-message--empty">
      <Icon name={icon} size={22} />
      <div>
        {title && <p className="status-message-title">{title}</p>}
        {children && <p className="status-message-text">{children}</p>}
        {action && <div className="status-message-action">{action}</div>}
      </div>
    </div>
  );
}

/**
 * Renders loading/error states for a TanStack query, or children(data).
 * Keeps every API-backed screen's states consistent.
 */
export function QueryState({ query, loadingLabel, children }) {
  if (query.isPending) return <LoadingState label={loadingLabel} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return children(query.data);
}
