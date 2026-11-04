import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ClinicLayout, { useClinic, useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { BarChart, LineChart } from '../../components/clinic/ClinicCharts';
import { PageTabs, Pill } from '../../components/clinic/ClinicUi';
import { DataTable, Field, Section, StatTiles } from '../../components/portal/PortalUi';
import { ErrorState, LoadingState, QueryState } from '../../components/StatusMessage';
import { getClinicStatusLabel } from '../../config/clinicNavigation';
import { getAppointmentReport, getInventoryItems, getReportAnalytics } from '../../services/clinicPortalApi';
import { businessTodayKey, dateFromKey } from '../../utils/dateTime';
import { downloadCsv } from '../../utils/csv';
import { stockStatus } from './ClinicInventoryPage';
import './ClinicReportsPage.css';

// Aggregate counts only: no patient-level details. Revenue is an estimate
// (listed price of completed visits). Export PDF uses the browser's print
// dialog ("Save as PDF"); Export Excel saves a CSV, which Excel opens.

const TABS = [
  { value: 'appointments', label: 'Appointments' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'treatments', label: 'Treatments' },
  { value: 'patients', label: 'Patients' },
  { value: 'inventory', label: 'Inventory' },
];

const count = (value) => new Intl.NumberFormat('en-PH').format(value ?? 0);
const peso = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount ?? 0);
const pesoAxis = (amount) => (amount >= 1000 ? `₱${Math.round(amount / 100) / 10}k` : `₱${amount}`);
const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 1000) / 10}% rate` : 'No data yet');

const monthLabels = (month) => {
  const date = dateFromKey(`${month}-01`);
  return {
    label: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date),
    fullLabel: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date),
  };
};

function SummaryCards({ cards }) {
  return (
    <div className="clinic-report-cards">
      {cards.map((card) => (
        <div key={card.label} className="clinic-report-card">
          <p className="clinic-report-card-value">{card.value}</p>
          <p className="clinic-report-card-label">{card.label}</p>
          <p className="clinic-report-card-note">{card.note}</p>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <section className="clinic-card-soft clinic-report-chart" aria-label={title}>
      <h2 className="clinic-card-soft-title">{title}</h2>
      {children}
    </section>
  );
}

function AppointmentsTab({ data }) {
  const { totals, year, months } = data;
  const rows = months.map((m) => ({ key: m.month, ...monthLabels(m.month), confirmed: m.confirmed, cancelled: m.cancelled }));

  return (
    <>
      <SummaryCards
        cards={[
          { label: 'Total', value: count(totals.appointments), note: 'Year to date' },
          { label: 'Confirmed', value: count(totals.confirmed), note: percent(totals.confirmed, totals.appointments) },
          { label: 'Cancelled', value: count(totals.cancelled), note: percent(totals.cancelled, totals.appointments) },
          { label: 'Avg / Day', value: totals.active_days ? (totals.appointments / totals.active_days).toFixed(1) : '0', note: 'Days with appointments' },
        ]}
      />
      <ChartCard title={`Monthly Appointment Trend (${year})`}>
        <BarChart
          caption={`Appointments by month, ${year}`}
          layout="grouped"
          height={260}
          labelHeader="Month"
          rows={rows}
          series={[
            { key: 'confirmed', label: 'Confirmed', color: 'blue' },
            { key: 'cancelled', label: 'Cancelled', color: 'red' },
          ]}
        />
      </ChartCard>
      <CustomRangeReport />
    </>
  );
}

function RevenueTab({ data }) {
  const { totals, year, months, currency } = data;
  const thisMonth = months[months.length - 1]?.revenue ?? 0;
  const lastMonth = months[months.length - 2]?.revenue ?? 0;
  const rows = months.map((m) => ({ key: m.month, ...monthLabels(m.month), value: m.revenue }));

  return (
    <>
      <SummaryCards
        cards={[
          { label: 'Revenue', value: peso(totals.revenue), note: `Year to date (${currency}, estimate)` },
          { label: 'This Month', value: peso(thisMonth), note: 'Completed visits × listed price' },
          { label: 'Last Month', value: peso(lastMonth), note: 'Completed visits × listed price' },
          { label: 'Avg / Visit', value: peso(totals.completed_visits ? totals.revenue / totals.completed_visits : 0), note: `${count(totals.completed_visits)} completed visits` },
        ]}
      />
      <ChartCard title={`Monthly Revenue (${year})`}>
        <LineChart caption={`Estimated revenue by month, ${year}`} rows={rows} height={260} valueLabel="Revenue" formatValue={peso} formatAxis={pesoAxis} />
      </ChartCard>
    </>
  );
}

function TreatmentsTab({ data }) {
  const { treatments, year } = data;
  const total = treatments.reduce((sum, t) => sum + t.total, 0);
  const top = treatments[0];
  const highest = Math.max(1, ...treatments.map((t) => t.total));

  return (
    <>
      <SummaryCards
        cards={[
          { label: 'Treatments', value: count(total), note: 'Booked, year to date' },
          { label: 'Services Used', value: count(treatments.length), note: 'Different services' },
          { label: 'Most Booked', value: top ? count(top.total) : '0', note: top?.service ?? 'No bookings yet' },
          { label: 'Top Share', value: top && total ? `${Math.round((top.total / total) * 100)}%` : '0%', note: 'Of all treatments' },
        ]}
      />
      <ChartCard title={`Treatments by Service (${year})`}>
        {treatments.length === 0 ? (
          <p className="clinic-card-soft-sub">No treatments booked yet this year.</p>
        ) : (
          <ul className="clinic-report-bars">
            {treatments.map((t) => (
              <li key={t.service}>
                <span className="clinic-report-bar-name">{t.service}</span>
                <span className="clinic-report-bar-track" aria-hidden="true">
                  <span style={{ width: `${(t.total / highest) * 100}%` }} />
                </span>
                <span className="clinic-report-bar-value">
                  {count(t.total)} · {peso(t.revenue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </>
  );
}

function PatientsTab({ data }) {
  const { totals, year, months } = data;
  const thisMonth = months[months.length - 1]?.new_patients ?? 0;
  const rows = months.map((m) => ({ key: m.month, ...monthLabels(m.month), new_patients: m.new_patients }));

  return (
    <>
      <SummaryCards
        cards={[
          { label: 'Total Patients', value: count(totals.patients), note: 'Registered with this clinic' },
          { label: 'New', value: count(totals.new_patients), note: 'Year to date' },
          { label: 'New This Month', value: count(thisMonth), note: 'Registered this month' },
          { label: 'Avg New / Month', value: months.length ? (totals.new_patients / months.length).toFixed(1) : '0', note: 'Year to date' },
        ]}
      />
      <ChartCard title={`New Patients by Month (${year})`}>
        <BarChart caption={`New patients by month, ${year}`} height={260} labelHeader="Month" rows={rows} series={[{ key: 'new_patients', label: 'New patients', color: 'blue' }]} />
      </ChartCard>
    </>
  );
}

function InventoryTab({ clinicId }) {
  const query = useQuery({ queryKey: ['clinic', clinicId, 'inventory', 'items', 'active'], queryFn: () => getInventoryItems(clinicId, {}) });

  return (
    <QueryState query={query} loadingLabel="Loading inventory…">
      {(items) => {
        const value = items.reduce((sum, item) => sum + item.quantity_usable * (item.unit_cost ?? 0), 0);
        const needing = items.filter((item) => stockStatus(item) !== 'good');
        return (
          <>
            <SummaryCards
              cards={[
                { label: 'Total Items', value: count(items.length), note: 'Active items' },
                { label: 'Low Stock', value: count(items.filter((i) => stockStatus(i) === 'low').length), note: 'Below minimum level' },
                { label: 'Critical', value: count(items.filter((i) => stockStatus(i) === 'critical').length), note: 'Needs immediate restock' },
                { label: 'Total Value', value: peso(value), note: 'Usable stock × unit cost' },
              ]}
            />
            <ChartCard title="Items to Restock">
              {needing.length === 0 ? (
                <p className="clinic-card-soft-sub">Every item is above its minimum stock.</p>
              ) : (
                <DataTable
                  caption="Items to restock"
                  rows={needing}
                  columns={[
                    { key: 'name', label: 'Item' },
                    { key: 'quantity_usable', label: 'Qty' },
                    { key: 'minimum_stock', label: 'Min. stock' },
                    { key: 'status', label: 'Status', render: (i) => (stockStatus(i) === 'critical' ? <Pill tone="danger">Critical</Pill> : <Pill tone="warning">Low</Pill>) },
                  ]}
                />
              )}
            </ChartCard>
          </>
        );
      }}
    </QueryState>
  );
}

// The earlier report: any date range, with services, dentists and ratings.
function CustomRangeReport() {
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
    <Section title="Custom date range" subtitle="Counts for the chosen dates (Philippine time).">
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
  );
}

/** Spreadsheet rows for the open tab. */
export function reportRows(tab, data, items = []) {
  switch (tab) {
    case 'revenue':
      return [['Month', 'Estimated revenue (PHP)', 'Completed visits'], ...data.months.map((m) => [m.month, m.revenue, m.completed_visits])];
    case 'treatments':
      return [['Service', 'Booked', 'Estimated revenue (PHP)'], ...data.treatments.map((t) => [t.service, t.total, t.revenue])];
    case 'patients':
      return [['Month', 'New patients'], ...data.months.map((m) => [m.month, m.new_patients])];
    case 'inventory':
      return [
        ['Item', 'Category', 'Brand', 'Qty', 'Unit', 'Min. stock', 'Next expiry', 'Unit cost (PHP)', 'Status'],
        ...items.map((i) => [i.name, i.category, i.brand, i.quantity_usable, i.unit, i.minimum_stock, i.next_expiry, i.unit_cost, stockStatus(i)]),
      ];
    default:
      return [['Month', 'Total', 'Confirmed', 'Cancelled'], ...data.months.map((m) => [m.month, m.total, m.confirmed, m.cancelled])];
  }
}

function ClinicReportsPage() {
  const { clinicId, membership, can } = useClinicAccess();
  const [tab, setTab] = useState('appointments');
  const [exportError, setExportError] = useState(null);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'analytics'],
    queryFn: () => getReportAnalytics(clinicId),
    enabled: can('reports.view'),
  });

  const exportExcel = async () => {
    setExportError(null);
    try {
      const items = tab === 'inventory' ? await getInventoryItems(clinicId, {}) : [];
      downloadCsv(`clinic-report-${tab}-${businessTodayKey()}.csv`, reportRows(tab, query.data, items));
    } catch {
      setExportError('The export could not be created. Please try again.');
    }
  };

  return (
    <ClinicLayout
      section="reports"
      title="Reports & Analytics"
      subtitle={`Data insights for ${membership?.clinic_name ?? 'this clinic'}`}
      requires={['reports.view']}
      hideSearch
      headerActions={
        <>
          <button type="button" className="btn btn-outline clinic-header-button" disabled={!query.data} onClick={() => window.print()}>
            <Icon name="download" size={18} />
            Export PDF
          </button>
          <button type="button" className="btn btn-outline clinic-header-button" disabled={!query.data} onClick={exportExcel}>
            <Icon name="download" size={18} />
            Export Excel
          </button>
        </>
      }
    >
      <div className="clinic-report">
        <PageTabs label="Report" value={tab} onChange={setTab} tabs={TABS} />
        {exportError && (
          <p className="portal-inline-error" role="alert">
            {exportError}
          </p>
        )}
        {query.isPending ? (
          <LoadingState label="Building reports…" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <>
            {tab === 'appointments' && <AppointmentsTab data={query.data} />}
            {tab === 'revenue' && <RevenueTab data={query.data} />}
            {tab === 'treatments' && <TreatmentsTab data={query.data} />}
            {tab === 'patients' && <PatientsTab data={query.data} />}
            {tab === 'inventory' && <InventoryTab clinicId={clinicId} />}
          </>
        )}
      </div>
    </ClinicLayout>
  );
}

export default ClinicReportsPage;
