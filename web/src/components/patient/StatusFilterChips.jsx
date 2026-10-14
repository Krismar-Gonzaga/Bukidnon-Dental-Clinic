import './StatusFilterChips.css';

// Single-choice filter row. filters: [{ id, label }]
function StatusFilterChips({ filters, activeId, onChange, label }) {
  return (
    <div className="status-filter-chips" role="group" aria-label={label}>
      {filters.map(({ id, label: filterLabel }) => {
        const isActive = id === activeId;
        return (
          <button
            key={id}
            type="button"
            className={`status-filter-chip${isActive ? ' is-active' : ''}`}
            aria-pressed={isActive}
            onClick={() => onChange(id)}
          >
            {filterLabel}
          </button>
        );
      })}
    </div>
  );
}

export default StatusFilterChips;
