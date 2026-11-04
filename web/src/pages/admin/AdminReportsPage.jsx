import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { SegmentedTabs } from '../../components/admin/AdminData';
import PlanPie from '../../components/admin/PlanPie';
import { Card } from '../../components/clinic/ClinicAdminUi';
import { BarChart } from '../../components/clinic/ClinicCharts';
import { FormError } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_REPORTS_HREF } from '../../config/adminNavigation';
import { exportReportCsv, getReports } from '../../services/adminApi';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'clinics', label: 'Clinics' },
  { value: 'users', label: 'Users' },
  { value: 'subscriptions', label: 'Subscriptions' },
];
const TITLES = { clinics: 'Clinics Report', users: 'Users Report', subscriptions: 'Subscriptions Report' };

const CHANGE_TONES = (change) => (change > 0 ? 'is-up' : change < 0 ? 'is-down' : '');
const signed = (change) => (change > 0 ? `+${change}` : String(change));

function ReportTable({ title, rows, data, month, onMonth }) {
  return (
    <Card
      title={title}
      actions={
        <label className="admin-month-filter">
          <span className="visually-hidden">Filter by month</span>
          <input type="month" value={month} placeholder="Filter by date..." onChange={(event) => onMonth(event.target.value)} />
        </label>
      }
    >
      <div className="admin-table-scroll">
        <table className="admin-grid is-report">
          <caption className="visually-hidden">
            {title}: {data.month_label} compared with {data.previous_label}
          </caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">{month ? data.month_label : 'This Month'}</th>
              <th scope="col">{month ? data.previous_label : 'Last Month'}</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric}>
                <th scope="row">{row.metric}</th>
                <td className="admin-report-current">{row.current}</td>
                <td>{row.previous}</td>
                <td className={`admin-report-change ${CHANGE_TONES(row.change)}`}>{signed(row.change)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AdminReportsPage() {
  const [tab, setTab] = useState('overview');
  const [month, setMonth] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'reports', month],
    queryFn: () => getReports({ month: month || undefined }),
    placeholderData: keepPreviousData,
  });
  const exportCsv = useMutation({
    mutationFn: () => exportReportCsv({ month: month || undefined, section: tab === 'overview' ? undefined : tab }),
  });

  return (
    <AdminLayout
      title="Reports & Analytics"
      subtitle="Platform-wide statistics"
      activeHref={ADMIN_REPORTS_HREF}
      headerActions={
        <button type="button" className="btn btn-outline" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
          <Icon name="download" size={18} />
          {exportCsv.isPending ? 'Exporting…' : 'Export Report'}
        </button>
      }
    >
      <div className="admin-tabs-row">
        <SegmentedTabs label="Reports" value={tab} tabs={TABS} onChange={setTab} />
      </div>
      <FormError error={exportCsv.error} />
      <QueryState query={query} loadingLabel="Loading reports…">
        {(data) =>
          tab === 'overview' ? (
            <div className="admin-report-columns">
              <Card title="Clinic Growth">
                <BarChart
                  caption="Verified clinics at the end of each month"
                  rows={data.overview.clinic_growth.map((point) => ({ key: point.month, label: point.label, clinics: point.total }))}
                  series={[{ key: 'clinics', label: 'Verified clinics', color: 'blue' }]}
                  labelHeader="Month"
                />
              </Card>
              <Card title="Subscription Plans">
                <PlanPie plans={data.overview.plans} caption="Clinics on each subscription plan" />
              </Card>
            </div>
          ) : (
            <ReportTable title={TITLES[tab]} rows={data[tab]} data={data} month={month} onMonth={setMonth} />
          )
        }
      </QueryState>
    </AdminLayout>
  );
}

export default AdminReportsPage;
