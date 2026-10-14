import { useState } from 'react';
import Icon from '../Icon';
import {
  DEFAULT_LOCATION,
  DEFAULT_SPECIALIZATION,
  LOCATION_OPTIONS,
  SPECIALIZATION_OPTIONS,
} from '../../config/searchOptions';
import './ClinicSearchPanel.css';

function SearchSelect({ id, label, icon, value, options, onChange }) {
  return (
    <div className="search-field">
      <label htmlFor={id} className="search-field-label">
        {label}
      </label>
      <div className="search-field-control">
        <Icon name={icon} size={18} className="search-field-icon" />
        <select
          id={id}
          className="search-field-input search-field-select"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={18} className="search-field-chevron" />
      </div>
    </div>
  );
}

// Visual search form only. Submitting does not call the backend yet.
function ClinicSearchPanel() {
  const [clinicName, setClinicName] = useState('');
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [specialization, setSpecialization] = useState(DEFAULT_SPECIALIZATION);

  const handleSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <form
      className="clinic-search"
      role="search"
      aria-label="Search dental clinics"
      onSubmit={handleSubmit}
    >
      <div className="search-field">
        <label htmlFor="search-clinic-name" className="search-field-label">
          Clinic Name
        </label>
        <div className="search-field-control">
          <Icon name="building" size={18} className="search-field-icon" />
          <input
            id="search-clinic-name"
            type="search"
            className="search-field-input"
            placeholder="Search clinic..."
            value={clinicName}
            onChange={(event) => setClinicName(event.target.value)}
          />
        </div>
      </div>

      <SearchSelect
        id="search-location"
        label="Location"
        icon="mapPin"
        value={location}
        options={LOCATION_OPTIONS}
        onChange={setLocation}
      />

      <SearchSelect
        id="search-specialization"
        label="Specialization"
        icon="tooth"
        value={specialization}
        options={SPECIALIZATION_OPTIONS}
        onChange={setSpecialization}
      />

      <button type="submit" className="btn btn-accent clinic-search-submit">
        <Icon name="search" size={18} />
        Search Now
      </button>
    </form>
  );
}

export default ClinicSearchPanel;
