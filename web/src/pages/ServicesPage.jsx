import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DirectoryPageLayout from '../layouts/DirectoryPageLayout';
import ServiceCategoryFilter from '../components/services/ServiceCategoryFilter';
import ServiceCard from '../components/services/ServiceCard';
import { ErrorState, LoadingState } from '../components/StatusMessage';
import { ALL_OPTION } from '../config/clinicDirectory';
import { FIND_CLINICS_HREF } from '../config/navigation';
import { getServiceCatalog } from '../services/publicApi';
import './ServicesPage.css';

// Service catalog with the published price range across listed clinics.
// Prices are each clinic's own; the range is indicative.
function ServicesPage() {
  const [category, setCategory] = useState(ALL_OPTION);
  const query = useQuery({ queryKey: ['services', 'catalog'], queryFn: getServiceCatalog });
  const services = useMemo(() => query.data ?? [], [query.data]);

  const categories = useMemo(
    () => [ALL_OPTION, ...[...new Set(services.map((s) => s.category))].sort((a, b) => a.localeCompare(b))],
    [services]
  );
  const results = category === ALL_OPTION ? services : services.filter((s) => s.category === category);

  return (
    <DirectoryPageLayout
      activeHref="/services"
      title="Affordable Care for Everyone"
      description="We bridge the gap between high-quality dental care and transparency in pricing across Bukidnon."
      resultsLabel="Services"
      centeredIntro
      filters={<ServiceCategoryFilter categories={categories} selected={category} onSelect={setCategory} />}
    >
      {query.isPending ? (
        <LoadingState label="Loading services…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <p className="visually-hidden" role="status">
            {`${results.length} ${results.length === 1 ? 'service' : 'services'} shown`}
          </p>
          {results.length > 0 ? (
            <ul className="services-grid">
              {results.map((service) => (
                <li key={service.id}>
                  <ServiceCard
                    service={service}
                    actionLabel="Find Clinics"
                    actionHref={service.clinicCount > 0 ? `${FIND_CLINICS_HREF}?service=${encodeURIComponent(service.name)}` : undefined}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="directory-empty">No services in this category yet.</p>
          )}
        </>
      )}
    </DirectoryPageLayout>
  );
}

export default ServicesPage;
