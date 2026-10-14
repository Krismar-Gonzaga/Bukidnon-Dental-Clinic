import { useMemo, useState } from 'react';
import DirectoryPageLayout from '../layouts/DirectoryPageLayout';
import ServiceCategoryFilter from '../components/services/ServiceCategoryFilter';
import ServiceCard from '../components/services/ServiceCard';
import { ALL_OPTION } from '../config/clinicDirectory';
import { SERVICE_CATEGORY_OPTIONS } from '../config/services';
import { SERVICES } from '../mocks/services';
import './ServicesPage.css';

// Services and indicative prices. Uses mock services until the API exists.
function ServicesPage({ services = SERVICES }) {
  const [category, setCategory] = useState(ALL_OPTION);

  const results = useMemo(
    () =>
      category === ALL_OPTION
        ? services
        : services.filter((service) => service.category === category),
    [services, category]
  );

  // Figma shows no visible count; announce it to screen readers only.
  const resultLabel = `${results.length} ${
    results.length === 1 ? 'service' : 'services'
  } shown`;

  return (
    <DirectoryPageLayout
      activeHref="/services"
      title="Affordable Care for Everyone"
      description="We bridge the gap between high-quality dental care and transparency in pricing across Bukidnon."
      resultsLabel="Services"
      centeredIntro
      filters={
        <ServiceCategoryFilter
          categories={SERVICE_CATEGORY_OPTIONS}
          selected={category}
          onSelect={setCategory}
        />
      }
    >
      <p className="visually-hidden" role="status">
        {resultLabel}
      </p>

      {results.length > 0 ? (
        <ul className="services-grid">
          {results.map((service) => (
            <li key={service.id}>
              <ServiceCard service={service} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="directory-empty">No services in this category yet.</p>
      )}
    </DirectoryPageLayout>
  );
}

export default ServicesPage;
