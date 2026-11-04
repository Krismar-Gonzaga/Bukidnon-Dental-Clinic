import { useQuery } from '@tanstack/react-query';
import DirectoryPageLayout from '../layouts/DirectoryPageLayout';
import { QueryState } from '../components/StatusMessage';
import { getLoginHref, getPublicClinicHref } from '../config/navigation';
import { getBookClinicHref } from '../config/patientNavigation';
import { getClinicMap } from '../services/publicApi';
import { Locator } from './ClinicLocatorPage';

// The clinic locator for guests. Booking asks them to sign in first.
function ClinicMapPage() {
  const clinics = useQuery({ queryKey: ['clinics', 'map'], queryFn: getClinicMap });

  return (
    <DirectoryPageLayout title="Clinic Map" description="Find the nearest verified dental clinic across Bukidnon." resultsLabel="Clinic map">
      <QueryState query={clinics} loadingLabel="Loading the map…">
        {(list) => <Locator clinics={list} getDetailsHref={getPublicClinicHref} getBookHref={(id) => getLoginHref(getBookClinicHref(id))} />}
      </QueryState>
    </DirectoryPageLayout>
  );
}

export default ClinicMapPage;
