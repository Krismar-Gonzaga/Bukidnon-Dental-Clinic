import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import DirectoryPageLayout from '../layouts/DirectoryPageLayout';
import ClinicDirectoryFilters from '../components/clinics/ClinicDirectoryFilters';
import ClinicDirectoryCard from '../components/clinics/ClinicDirectoryCard';
import Pagination from '../components/Pagination';
import { ErrorState, LoadingState } from '../components/StatusMessage';
import {
  ALL_OPTION,
  CLINICS_PER_PAGE,
  DEFAULT_SORT,
  SORT_OPTIONS,
} from '../config/clinicDirectory';
import { getLoginHref, getPublicClinicHref } from '../config/navigation';
import { getBookClinicHref } from '../config/patientNavigation';
import { useAuth } from '../auth/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { getCities, getSpecializations, searchClinics } from '../services/publicApi';

const orAll = (value) => (value === ALL_OPTION ? '' : value);

/**
 * Clinic directory with server-side search, filters and pagination.
 * getBookHref(clinic) / getDetailsHref(clinic) override the card links
 * ?search= and ?city= prefill the filters (from the home page search panel).
 */
function FindClinicsPage() {
  const { user } = useAuth();
  const getBookHref = (clinic) =>
    user?.role === 'patient' ? getBookClinicHref(clinic.id) : getLoginHref(getBookClinicHref(clinic.id));
  const getDetailsHref = (clinic) => getPublicClinicHref(clinic.id);
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    query: searchParams.get('search') ?? '',
    location: searchParams.get('city') ?? ALL_OPTION,
    specialization: searchParams.get('specialization') ?? ALL_OPTION,
    sort: DEFAULT_SORT,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const query = useDebouncedValue(filters.query);
  const service = searchParams.get('service') ?? '';

  const cities = useQuery({ queryKey: ['cities'], queryFn: getCities, staleTime: 10 * 60 * 1000 });
  const specializations = useQuery({ queryKey: ['specializations'], queryFn: getSpecializations, staleTime: 10 * 60 * 1000 });

  const results = useQuery({
    queryKey: ['clinics', 'search', query, service, filters.location, filters.specialization, filters.sort, currentPage],
    queryFn: () =>
      searchClinics({
        query,
        city: orAll(filters.location),
        specialization: orAll(filters.specialization),
        service,
        sort: filters.sort,
        page: currentPage,
        perPage: CLINICS_PER_PAGE,
      }),
    placeholderData: keepPreviousData,
  });

  const handleFilterChange = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setCurrentPage(1);
  };

  const total = results.data?.total ?? 0;
  const pageResults = results.data?.clinics ?? [];

  return (
    <DirectoryPageLayout
      activeHref="/clinics"
      title="Clinic Directory"
      description="Discover and compare verified dental clinics across Bukidnon."
      resultsLabel="Clinic results"
      filters={
        <ClinicDirectoryFilters
          filters={filters}
          locationOptions={[ALL_OPTION, ...(cities.data ?? [])]}
          specializationOptions={[ALL_OPTION, ...(specializations.data ?? []).map(({ name }) => name)]}
          sortOptions={SORT_OPTIONS}
          onFilterChange={handleFilterChange}
        />
      }
    >
      {results.isPending ? (
        <LoadingState label="Finding clinics…" />
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : (
        <>
          <p className="directory-count" role="status">
            {`${total} ${total === 1 ? 'clinic' : 'clinics'} found`}
          </p>

          {pageResults.length > 0 ? (
            <ul className="directory-grid" aria-busy={results.isFetching}>
              {pageResults.map((clinic, index) => (
                <li key={clinic.id}>
                  <ClinicDirectoryCard
                    clinic={clinic}
                    accentIndex={(currentPage - 1) * CLINICS_PER_PAGE + index}
                    bookHref={getBookHref(clinic)}
                    detailsHref={getDetailsHref(clinic)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="directory-empty">No clinics match your search. Try a different name or filter.</p>
          )}

          <Pagination
            currentPage={currentPage}
            pageCount={results.data?.pageCount ?? 1}
            onPageChange={setCurrentPage}
            label="Clinic results pages"
          />
        </>
      )}
    </DirectoryPageLayout>
  );
}

export default FindClinicsPage;
