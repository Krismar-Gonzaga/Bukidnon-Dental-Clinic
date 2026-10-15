import { useQuery } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import { DataTable, Section, StatTiles } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_APPLICATIONS_HREF, ADMIN_DASHBOARD_HREF, ADMIN_REVIEWS_HREF, USER_ROLE_LABELS } from '../../config/adminNavigation';
import { getAdminDashboard } from '../../services/adminApi';
import { formatDateTime } from '../../utils/dateTime';

// Platform summary: aggregates only, no patient-level data.
function AdminDashboardPage() {
  const query = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: getAdminDashboard });

  return (
    <AdminLayout title="Platform Overview" activeHref={ADMIN_DASHBOARD_HREF}>
      <QueryState query={query} loadingLabel="Loading overview…">
        {(data) => (
          <div className="portal-stack">
            <StatTiles
              stats={[
                { label: 'Clinics (total)', value: data.clinics.total },
                { label: 'Listed clinics', value: data.clinics.listed },
                { label: 'Suspended clinics', value: data.clinics.suspended },
                { label: 'Applications pending', value: data.applications.pending },
                { label: 'Under review', value: data.applications.under_review },
                { label: 'Approved', value: data.applications.approved },
                { label: 'Rejected', value: data.applications.rejected },
                { label: 'Open review reports', value: data.open_review_reports },
              ]}
            />
            <div className="portal-grid-2">
              <Section title="Users by account type">
                <DataTable
                  caption="Users by role"
                  rowKey={(r) => r.role}
                  rows={Object.entries(data.users).map(([role, total]) => ({ role, total }))}
                  columns={[
                    { key: 'role', label: 'Account type', render: (r) => USER_ROLE_LABELS[r.role] ?? r.role },
                    { key: 'total', label: 'Users' },
                  ]}
                />
              </Section>
              <Section
                title="Recent administrative activity"
                actions={
                  <>
                    <a href={ADMIN_APPLICATIONS_HREF} className="btn btn-outline btn-sm">Verification queue</a>
                    <a href={ADMIN_REVIEWS_HREF} className="btn btn-outline btn-sm">Reports</a>
                  </>
                }
              >
                <DataTable
                  caption="Recent activity"
                  rowKey={(r) => `${r.action}-${r.created_at}-${r.subject_id}`}
                  rows={data.recent_activity}
                  emptyText="No activity yet."
                  columns={[
                    { key: 'created_at', label: 'When', render: (r) => formatDateTime(r.created_at) },
                    { key: 'action', label: 'Action' },
                    { key: 'subject', label: 'Subject', render: (r) => (r.subject_type ? `${r.subject_type} #${r.subject_id}` : '—') },
                  ]}
                />
              </Section>
            </div>
          </div>
        )}
      </QueryState>
    </AdminLayout>
  );
}

export default AdminDashboardPage;
