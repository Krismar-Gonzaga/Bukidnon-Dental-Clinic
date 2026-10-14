import { useMemo, useState } from 'react';
import DirectoryPageLayout from '../layouts/DirectoryPageLayout';
import ClinicDirectoryFilters from '../components/clinics/ClinicDirectoryFilters';
import ClinicDirectoryCard from '../components/clinics/ClinicDirectoryCard';
import Pagination from '../components/Pagination';
import {
  ALL_OPTION,
  CLINICS_PER_PAGE,
  DEFAULT_SORT,
  SORT_OPTIONS,
} from '../config/clinicDirectory';
import { DIRECTORY_CLINICS } from '../mocks/directoryClinics';
import {
  filterClinics,
  getLocationOptions,
  getPageCount,
  getSpecializationOptions,
  paginate,
  sortClinics,
} from '../utils/clinicDirectory';

const INITIAL_FILTERS = {
  query: '',
  location: ALL_OPTION,
  specialization: ALL_OPTION,
  sort: DEFAULT_SORT,
};

// Clinic directory. Uses mock clinics until the clinics API is integrated.
function FindClinicsPage({ clinics = DIRECTORY_CLINICS }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);

  const locationOptions = useMemo(() => getLocationOptions(clinics), [clinics]);
  const specializationOptions = useMemo(
    () => getSpecializationOptions(clinics),
    [clinics]
  );

  const results = useMemo(
    () => sortClinics(filterClinics(clinics, filters), filters.sort),
    [clinics, filters]
  );
  const pageCount = getPageCount(results.length, CLINICS_PER_PAGE);
  const pageResults = paginate(results, currentPage, CLINICS_PER_PAGE);

  const handleFilterChange = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setCurrentPage(1);
  };

  const resultLabel = `${results.length} ${
    results.length === 1 ? 'clinic' : 'clinics'
  } found`;

  return (
    <DirectoryPageLayout
      activeHref="/clinics"
      title="Clinic Directory"
      description="Discover and compare verified dental clinics across Bukidnon."
      resultsLabel="Clinic results"
      filters={
        <ClinicDirectoryFilters
          filters={filters}
          locationOptions={locationOptions}
          specializationOptions={specializationOptions}
          sortOptions={SORT_OPTIONS}
          onFilterChange={handleFilterChange}
        />
      }
    >
      <p className="directory-count" role="status">
        {resultLabel}
      </p>

      {pageResults.length > 0 ? (
        <ul className="directory-grid">
          {pageResults.map((clinic, index) => (
            <li key={clinic.id}>
              <ClinicDirectoryCard
                clinic={clinic}
                accentIndex={(currentPage - 1) * CLINICS_PER_PAGE + index}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="directory-empty">
          No clinics match your search. Try a different name or filter.
        </p>
      )}

      <Pagination
        currentPage={currentPage}
        pageCount={pageCount}
        onPageChange={setCurrentPage}
        label="Clinic results pages"
      />
    </DirectoryPageLayout>
  );
}

export default FindClinicsPage;
