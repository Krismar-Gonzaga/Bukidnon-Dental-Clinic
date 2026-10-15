import { useQuery } from '@tanstack/react-query';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import { Badge, DataTable, Section, StatTiles } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref } from '../../config/clinicNavigation';
import { getClinicDashboard } from '../../services/clinicPortalApi';
import { toAppointment, toReview } from '../../services/adapters';
import { formatTime } from '../../utils/dateTime';

function Dashboard() {
  const { clinicId } = useClinic();
  const query = useQuery({ queryKey: ['clinic', clinicId, 'dashboard'], queryFn: () => getClinicDashboard(clinicId) });

  return (
    <QueryState query={query} loadingLabel="Loading dashboard…">
      {(data) => {
        const today = (data.appointments?.today ?? []).map(toAppointment);
        const stats = [
          data.appointments && { label: "Today's appointments", value: today.length },
          data.appointments && { label: 'Pending requests', value: data.appointments.pending_requests },
          data.appointments && { label: 'Upcoming', value: data.appointments.upcoming },
          data.appointments && { label: 'Completed this month', value: data.appointments.completed_this_month },
          data.appointments && { label: 'Cancelled this month', value: data.appointments.cancelled_this_month },
          data.active_patients != null && { label: 'Registered patients', value: data.active_patients },
          data.inventory && { label: 'Low-stock items', value: data.inventory.low_stock },
          data.inventory && { label: 'Expiring soon', value: data.inventory.near_expiry },
          data.inventory && { label: 'Expired batches', value: data.inventory.expired },
          data.feedback && { label: 'Rating', value: data.feedback.rating },
        ].filter(Boolean);

        return (
          <div className="portal-stack">
            <StatTiles stats={stats} />

            {data.appointments && (
              <Section
                title="Today's schedule"
                actions={
                  <a href={getClinicHref(clinicId, 'appointments')} className="btn btn-outline btn-sm">
                    All appointments
                  </a>
                }
              >
                <DataTable
                  caption="Today's appointments"
                  rows={today}
                  emptyText="No appointments today."
                  columns={[
                    { key: 'time', label: 'Time', render: (a) => formatTime(a.startsAt) },
                    { key: 'patient', label: 'Patient', render: (a) => a.patient?.name },
                    { key: 'service', label: 'Service' },
                    { key: 'dentist', label: 'Dentist' },
                    { key: 'status', label: 'Status', render: (a) => <Badge status={a.backendStatus} /> },
                    {
                      key: 'open',
                      label: '',
                      render: (a) => (
                        <a href={`${getClinicHref(clinicId, 'appointments')}/${a.id}`} aria-label={`Open appointment ${a.reference}`}>
                          Open
                        </a>
                      ),
                    },
                  ]}
                />
              </Section>
            )}

            {data.feedback && (
              <Section title="Recent feedback">
                <ul className="portal-list">
                  {data.feedback.recent.map(toReview).map((review) => (
                    <li key={review.id} className="portal-list-item">
                      <strong>{review.rating}/5</strong> · {review.patientName} <Badge status={review.status} />
                      {review.comment && <p className="portal-list-item-meta">{review.comment}</p>}
                    </li>
                  ))}
                  {data.feedback.recent.length === 0 && <li className="portal-empty">No reviews yet.</li>}
                </ul>
              </Section>
            )}
          </div>
        );
      }}
    </QueryState>
  );
}

function ClinicDashboardPage() {
  return (
    <ClinicLayout section="dashboard" title="Clinic Dashboard">
      <Dashboard />
    </ClinicLayout>
  );
}

export default ClinicDashboardPage;
