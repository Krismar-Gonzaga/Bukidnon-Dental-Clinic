import Icon from './Icon';
import './Pagination.css';

// Numbered pagination. Renders nothing when there is only one page.
function Pagination({ currentPage, pageCount, onPageChange, label = 'Pagination' }) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav className="pagination" aria-label={label}>
      <button
        type="button"
        className="pagination-button"
        aria-label="Previous page"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <Icon name="chevronLeft" size={16} />
      </button>

      <ul className="pagination-list">
        {pages.map((page) => {
          const isCurrent = page === currentPage;
          return (
            <li key={page}>
              <button
                type="button"
                className={`pagination-button${isCurrent ? ' is-current' : ''}`}
                aria-label={`Page ${page}`}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => onPageChange(page)}
              >
                {page}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="pagination-button"
        aria-label="Next page"
        disabled={currentPage === pageCount}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  );
}

export default Pagination;
