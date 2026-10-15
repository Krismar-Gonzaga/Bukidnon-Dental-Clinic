import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Icon from '../Icon';
import { ALL_OPTION } from '../../config/clinicDirectory';
import { FIND_CLINICS_HREF } from '../../config/navigation';
import { getCities, getSpecializations } from '../../services/publicApi';
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
              {option === ALL_OPTION ? `Any ${label.toLowerCase()}` : option}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={18} className="search-field-chevron" />
      </div>
    </div>
  );
}

// Opens the clinic directory with these filters applied. Locations and
// specializations come from the listed clinics.
function ClinicSearchPanel() {
  const navigate = useNavigate();
  const [clinicName, setClinicName] = useState('');
  const [location, setLocation] = useState(ALL_OPTION);
  const [specialization, setSpecialization] = useState(ALL_OPTION);

  const cities = useQuery({ queryKey: ['cities'], queryFn: getCities, staleTime: 10 * 60 * 1000 });
  const specializations = useQuery({ queryKey: ['specializations'], queryFn: getSpecializations, staleTime: 10 * 60 * 1000 });

  const handleSubmit = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (clinicName.trim()) params.set('search', clinicName.trim());
    if (location !== ALL_OPTION) params.set('city', location);
    if (specialization !== ALL_OPTION) params.set('specialization', specialization);
    navigate(`${FIND_CLINICS_HREF}${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <form className="clinic-search" role="search" aria-label="Search dental clinics" onSubmit={handleSubmit}>
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
        options={[ALL_OPTION, ...(cities.data ?? [])]}
        onChange={setLocation}
      />

      <SearchSelect
        id="search-specialization"
        label="Specialization"
        icon="tooth"
        value={specialization}
        options={[ALL_OPTION, ...(specializations.data ?? []).map(({ name }) => name)]}
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
