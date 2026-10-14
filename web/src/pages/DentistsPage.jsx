import { useMemo, useState } from 'react';
import DirectoryPageLayout from '../layouts/DirectoryPageLayout';
import DentistDirectoryFilters from '../components/dentists/DentistDirectoryFilters';
import DentistDirectoryCard from '../components/dentists/DentistDirectoryCard';
import Pagination from '../components/Pagination';
import { ALL_OPTION } from '../config/clinicDirectory';
import { DENTISTS_PER_PAGE } from '../config/dentistDirectory';
import { DIRECTORY_CLINICS } from '../mocks/directoryClinics';
import { DIRECTORY_DENTISTS } from '../mocks/directoryDentists';
import { getPageCount, paginate } from '../utils/clinicDirectory';
import {
  filterDentists,
  getSpecialtyOptions,
  withClinicNames,
} from '../utils/dentistDirectory';

const INITIAL_FILTERS = {
  query: '',
  specialty: ALL_OPTION,
};

// Dentist directory. Uses mock dentists until the dentists API is integrated.
function DentistsPage({
  dentists = DIRECTORY_DENTISTS,
  clinics = DIRECTORY_CLINICS,
}) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);

  const listings = useMemo(
    () => withClinicNames(dentists, clinics),
    [dentists, clinics]
  );
  const specialtyOptions = useMemo(() => getSpecialtyOptions(dentists), [dentists]);

  const results = useMemo(
    () => filterDentists(listings, filters),
    [listings, filters]
  );
  const pageCount = getPageCount(results.length, DENTISTS_PER_PAGE);
  const pageResults = paginate(results, currentPage, DENTISTS_PER_PAGE);

  const handleFilterChange = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setCurrentPage(1);
  };

  // Figma shows no visible count; announce it to screen readers only.
  const resultLabel = `${results.length} ${
    results.length === 1 ? 'dentist' : 'dentists'
  } found`;

  return (
    <DirectoryPageLayout
      activeHref="/dentists"
      title="Dentist Directory"
      description="Find the right dental specialist for your needs in Bukidnon."
      resultsLabel="Dentist results"
      filters={
        <DentistDirectoryFilters
          filters={filters}
          specialtyOptions={specialtyOptions}
          onFilterChange={handleFilterChange}
        />
      }
    >
      <p className="visually-hidden" role="status">
        {resultLabel}
      </p>

      {pageResults.length > 0 ? (
        <ul className="directory-grid">
          {pageResults.map((dentist, index) => (
            <li key={dentist.id}>
              <DentistDirectoryCard
                dentist={dentist}
                accentIndex={(currentPage - 1) * DENTISTS_PER_PAGE + index}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="directory-empty">
          No dentists match your search. Try a different name or specialization.
        </p>
      )}

      <Pagination
        currentPage={currentPage}
        pageCount={pageCount}
        onPageChange={setCurrentPage}
        label="Dentist results pages"
      />
    </DirectoryPageLayout>
  );
}

export default DentistsPage;
