import Icon from '../Icon';
import {
  FilterSelect,
  toOptions,
} from '../clinics/ClinicDirectoryFilters';
import '../clinics/ClinicDirectoryFilters.css';
import './DentistDirectoryFilters.css';

// Controlled filter bar; the page owns the filter state. The Figma design has
// no visible labels here, so labels are kept for screen readers only.
function DentistDirectoryFilters({ filters, specialtyOptions, onFilterChange }) {
  return (
    <form
      className="dentist-filters"
      role="search"
      aria-label="Filter dentist directory"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="dir-filter">
        <label htmlFor="dentist-search" className="visually-hidden">
          Search dentist
        </label>
        <div className="dir-filter-control">
          <Icon name="search" size={16} className="dir-filter-icon" />
          <input
            id="dentist-search"
            type="search"
            className="dir-filter-input"
            placeholder="Search dentist by name..."
            value={filters.query}
            onChange={(event) => onFilterChange('query', event.target.value)}
          />
        </div>
      </div>

      <FilterSelect
        id="dentist-specialty"
        label="Specialization"
        icon="stethoscope"
        value={filters.specialty}
        options={toOptions(specialtyOptions)}
        onChange={(value) => onFilterChange('specialty', value)}
        hideLabel
      />
    </form>
  );
}

export default DentistDirectoryFilters;
