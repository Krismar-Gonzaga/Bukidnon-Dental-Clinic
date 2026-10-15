import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import { DataTable, Field, Section, StatTiles } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { getClinicStatusLabel } from '../../config/clinicNavigation';
import { getAppointmentReport } from '../../services/clinicPortalApi';
import { businessTodayKey } from '../../utils/dateTime';

// Aggregate counts only — no patient-level details.
function Report() {
  const { clinicId } = useClinic();
  const today = businessTodayKey();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'report', from, to],
    queryFn: () => getAppointmentReport(clinicId, { from, to }),
    enabled: Boolean(from && to && from <= to),
  });

  return (
    <div className="portal-stack">
      <Section title="Appointment report" subtitle="Counts for the chosen dates (Philippine time).">
        <div className="portal-toolbar">
          <Field label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <Field label="To" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        <QueryState query={query} loadingLabel="Building report…">
          {(data) => (
            <div className="portal-stack">
              <StatTiles
                stats={[
                  ...Object.entries(data.by_status).map(([status, total]) => ({ label: getClinicStatusLabel(status), value: total })),
                  { label: 'New patients', value: data.new_patients },
                  { label: 'Reviews', value: data.reviews.count },
                  { label: 'Average rating', value: data.reviews.count ? data.reviews.average : '—' },
                ]}
              />
              <div className="portal-grid-2">
                <DataTable caption="By service" rowKey={(r) => r.service} rows={data.by_service} emptyText="No appointments." columns={[{ key: 'service', label: 'Service' }, { key: 'total', label: 'Appointments' }]} />
                <DataTable caption="By dentist" rowKey={(r) => r.dentist} rows={data.by_dentist} emptyText="No appointments." columns={[{ key: 'dentist', label: 'Dentist' }, { key: 'total', label: 'Appointments' }]} />
              </div>
            </div>
          )}
        </QueryState>
      </Section>
    </div>
  );
}

function ClinicReportsPage() {
  return (
    <ClinicLayout section="reports" title="Reports" requires={['reports.view']}>
      <Report />
    </ClinicLayout>
  );
}

export default ClinicReportsPage;
