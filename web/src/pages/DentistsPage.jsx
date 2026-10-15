import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import DirectoryPageLayout from '../layouts/DirectoryPageLayout';
import DentistDirectoryFilters from '../components/dentists/DentistDirectoryFilters';
import DentistDirectoryCard from '../components/dentists/DentistDirectoryCard';
import Pagination from '../components/Pagination';
import { ErrorState, LoadingState } from '../components/StatusMessage';
import { ALL_OPTION } from '../config/clinicDirectory';
import { DENTISTS_PER_PAGE } from '../config/dentistDirectory';
import { getPublicClinicHref } from '../config/navigation';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { getDentists, getSpecializations } from '../services/publicApi';

// Dentists working at listed clinics, searched and paginated on the server.
function DentistsPage() {
  const [filters, setFilters] = useState({ query: '', specialty: ALL_OPTION });
  const [currentPage, setCurrentPage] = useState(1);
  const query = useDebouncedValue(filters.query);

  const specializations = useQuery({ queryKey: ['specializations'], queryFn: getSpecializations, staleTime: 10 * 60 * 1000 });
  const specializationId = specializations.data?.find(({ name }) => name === filters.specialty)?.id;

  const results = useQuery({
    queryKey: ['dentists', query, specializationId, currentPage],
    queryFn: () => getDentists({ query, specializationId, page: currentPage, perPage: DENTISTS_PER_PAGE }),
    placeholderData: keepPreviousData,
  });

  const handleFilterChange = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setCurrentPage(1);
  };

  const dentists = results.data?.dentists ?? [];
  const total = results.data?.total ?? 0;

  return (
    <DirectoryPageLayout
      activeHref="/dentists"
      title="Dentist Directory"
      description="Find the right dental specialist for your needs in Bukidnon."
      resultsLabel="Dentist results"
      filters={
        <DentistDirectoryFilters
          filters={filters}
          specialtyOptions={[ALL_OPTION, ...(specializations.data ?? []).map(({ name }) => name)]}
          onFilterChange={handleFilterChange}
        />
      }
    >
      {results.isPending ? (
        <LoadingState label="Finding dentists…" />
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : (
        <>
          <p className="visually-hidden" role="status">
            {`${total} ${total === 1 ? 'dentist' : 'dentists'} found`}
          </p>

          {dentists.length > 0 ? (
            <ul className="directory-grid">
              {dentists.map((dentist, index) => (
                <li key={dentist.id}>
                  <DentistDirectoryCard
                    dentist={dentist}
                    accentIndex={(currentPage - 1) * DENTISTS_PER_PAGE + index}
                    profileHref={dentist.clinics[0] ? getPublicClinicHref(dentist.clinics[0].id) : undefined}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="directory-empty">No dentists match your search. Try a different name or specialization.</p>
          )}

          <Pagination
            currentPage={currentPage}
            pageCount={results.data?.pageCount ?? 1}
            onPageChange={setCurrentPage}
            label="Dentist results pages"
          />
        </>
      )}
    </DirectoryPageLayout>
  );
}

export default DentistsPage;
