import Icon from '../Icon';
import './ClinicDirectoryFilters.css';

// Shared with other directory filter bars. `hideLabel` keeps the label for
// screen readers when the design shows no visible label.
export function FilterSelect({
  id,
  label,
  icon,
  value,
  options,
  onChange,
  hideLabel = false,
}) {
  return (
    <div className="dir-filter dir-filter--select">
      <label
        htmlFor={id}
        className={hideLabel ? 'visually-hidden' : 'dir-filter-label'}
      >
        {label}
      </label>
      <div className="dir-filter-control">
        <Icon name={icon} size={16} className="dir-filter-icon" />
        <select
          id={id}
          className="dir-filter-input dir-filter-select"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={16} className="dir-filter-chevron" />
      </div>
    </div>
  );
}

export const toOptions = (values) =>
  values.map((value) => ({ value, label: value }));

// Controlled filter bar; the page owns the filter state.
function ClinicDirectoryFilters({
  filters,
  locationOptions,
  specializationOptions,
  sortOptions,
  onFilterChange,
}) {
  return (
    <form
      className="dir-filters"
      role="search"
      aria-label="Filter clinic directory"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="dir-filter dir-filter--search">
        <label htmlFor="dir-search" className="dir-filter-label">
          Search Clinic
        </label>
        <div className="dir-filter-control">
          <Icon name="search" size={16} className="dir-filter-icon" />
          <input
            id="dir-search"
            type="search"
            className="dir-filter-input"
            placeholder="Search by clinic name..."
            value={filters.query}
            onChange={(event) => onFilterChange('query', event.target.value)}
          />
        </div>
      </div>

      <FilterSelect
        id="dir-location"
        label="Location"
        icon="mapPin"
        value={filters.location}
        options={toOptions(locationOptions)}
        onChange={(value) => onFilterChange('location', value)}
      />

      <FilterSelect
        id="dir-specialization"
        label="Specialization"
        icon="stethoscope"
        value={filters.specialization}
        options={toOptions(specializationOptions)}
        onChange={(value) => onFilterChange('specialization', value)}
      />

      <FilterSelect
        id="dir-sort"
        label="Sort By"
        icon="sliders"
        value={filters.sort}
        options={sortOptions}
        onChange={(value) => onFilterChange('sort', value)}
      />
    </form>
  );
}

export default ClinicDirectoryFilters;
