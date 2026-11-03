import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { Badge, DataTable, Section } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref, isDentistMember } from '../../config/clinicNavigation';
import { getAppointmentReport, getClinicDashboard } from '../../services/clinicPortalApi';
import { getErrorMessage } from '../../services/apiErrors';
import { toAppointment, toReview } from '../../services/adapters';
import { formatTime } from '../../utils/dateTime';
import { directionsUrl, embedUrl, hasCoordinates, projectToMap } from '../../utils/maps';
import { useDropdown } from '../../hooks/useDropdown';
import { alertKey, useDismissedAlerts } from '../../hooks/useDismissedAlerts';
import { useAuth } from '../../auth/AuthContext';
import { downloadCsv } from '../../utils/csv';
import ClinicAdminOverview from './ClinicAdminOverview';
import DentistOverview from './DentistOverview';
import './ClinicDashboardPage.css';

const peso = (amount, compact = false) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  }).format(amount ?? 0);

const count = (value) => new Intl.NumberFormat('en-PH').format(value ?? 0);
const plural = (n, one, many) => `${count(n)} ${n === 1 ? one : many}`;

/** "+12.5% from last month" with a direction, or a plain note when there is nothing to compare. */
function monthChange(current, previous) {
  if (!previous) return { text: current ? 'New activity this month' : 'No activity yet this month', direction: 'flat' };
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  if (pct === 0) return { text: 'Same as last month', direction: 'flat' };
  return { text: `${pct > 0 ? '+' : ''}${pct}% from last month`, direction: pct > 0 ? 'up' : 'down' };
}

const updatedLabel = (timestamp) =>
  timestamp
    ? `Last updated: Today, ${new Date(timestamp).toLocaleTimeString('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
      })}`
    : '';

function MetricCard({ label, value, icon, change, note, highlight, action }) {
  return (
    <div className={`clinic-metric${highlight ? ' is-highlight' : ''}`}>
      <div className="clinic-metric-body">
        <p className="clinic-metric-label">{label}</p>
        <p className="clinic-metric-value">{value}</p>
        {change && (
          <p className={`clinic-metric-change is-${change.direction}`}>
            {change.direction !== 'flat' && <Icon name={change.direction === 'up' ? 'trendingUp' : 'trendingDown'} size={16} />}
            {change.text}
          </p>
        )}
        {note && <p className="clinic-metric-note">{note}</p>}
        {action && (
          <a href={action.href} className="clinic-metric-action">
            {action.label}
            <Icon name="arrowRight" size={14} />
          </a>
        )}
      </div>
      <Icon name={icon} size={96} className="clinic-metric-icon" />
    </div>
  );
}

function buildMetrics(data, clinicId) {
  const appointments = data.appointments;
  const pendingHref = `${getClinicHref(clinicId, 'appointments')}?status=pending`;
  const pending = appointments && {
    key: 'pending',
    label: 'Pending requests',
    value: count(appointments.pending_requests),
    icon: 'checkCircle',
    highlight: true,
    note: appointments.pending_requests ? 'Waiting for confirmation' : 'Nothing waiting',
    action: appointments.pending_requests ? { href: pendingHref, label: 'Review requests' } : null,
  };

  const overview = data.overview;
  if (overview) {
    const branches = overview.branches.length;
    return [
      {
        key: 'appointments',
        label: 'Total appointments',
        value: count(overview.appointments.this_month),
        icon: 'calendarBlank',
        change: monthChange(overview.appointments.this_month, overview.appointments.last_month),
      },
      {
        key: 'revenue',
        label: 'Estimated revenue',
        value: peso(overview.revenue_estimate.this_month, overview.revenue_estimate.this_month >= 100000),
        icon: 'barChart',
        change: monthChange(overview.revenue_estimate.this_month, overview.revenue_estimate.last_month),
        note: 'Completed visits × listed price',
      },
      {
        key: 'staff',
        label: 'Active staff',
        value: count(overview.staff.active),
        icon: 'users',
        note: `${plural(overview.staff.dentists, 'dentist', 'dentists')} · across ${plural(branches, 'branch', 'branches')}`,
      },
      pending,
    ].filter(Boolean);
  }

  // Dentists, receptionists and inventory staff: what their role covers.
  return [
    appointments && { key: 'today', label: "Today's appointments", value: count(appointments.today.length), icon: 'calendarBlank' },
    pending,
    appointments && { key: 'upcoming', label: 'Upcoming', value: count(appointments.upcoming), icon: 'history' },
    appointments && { key: 'completed', label: 'Completed this month', value: count(appointments.completed_this_month), icon: 'checkCircle' },
    data.inventory && { key: 'low', label: 'Low-stock items', value: count(data.inventory.low_stock), icon: 'clipboardList', highlight: !appointments },
    data.inventory && { key: 'expiring', label: 'Expiring soon', value: count(data.inventory.near_expiry), icon: 'alertTriangle' },
    data.inventory && { key: 'expired', label: 'Expired batches', value: count(data.inventory.expired), icon: 'alertCircle' },
  ].filter(Boolean);
}

function branchStatus(branch) {
  if (branch.open_now) return { label: 'Open now', tone: 'success' };
  if (branch.hours_today) return { label: 'Closed now', tone: 'neutral' };
  return { label: 'Closed today', tone: 'warning' };
}

const branchPlace = (branch, clinicName) => ({
  name: `${clinicName} ${branch.name}`,
  address: `${branch.address}, ${branch.city}`,
  latitude: branch.latitude,
  longitude: branch.longitude,
});

// The ⋮ menu on a branch row.
function BranchRowMenu({ branch, clinicName }) {
  const { clinicId, can } = useClinic();
  const dropdown = useDropdown();
  const menuId = useId();

  return (
    <div className="clinic-row-menu" ref={dropdown.wrapperRef}>
      <button
        ref={dropdown.triggerRef}
        type="button"
        className="clinic-row-menu-button"
        aria-label={`Actions for ${branch.name}`}
        aria-expanded={dropdown.isOpen}
        aria-controls={menuId}
        onClick={dropdown.toggle}
      >
        <Icon name="moreVertical" size={18} />
      </button>
      {dropdown.isOpen && (
        <ul id={menuId} className="clinic-row-menu-panel">
          {can('clinic.branches.manage', 'clinic.schedules.manage') && (
            <li>
              <a href={getClinicHref(clinicId, 'branches')}>Manage branch &amp; hours</a>
            </li>
          )}
          {can('appointments.view_all') && (
            <li>
              <a href={getClinicHref(clinicId, 'appointments')}>Today&apos;s schedule</a>
            </li>
          )}
          <li>
            <a href={directionsUrl(branchPlace(branch, clinicName))} target="_blank" rel="noreferrer" onClick={dropdown.close}>
              Directions in Google Maps
            </a>
          </li>
        </ul>
      )}
    </div>
  );
}

function BranchPerformance({ branches }) {
  const { clinicId, clinicName } = useClinic();
  const branchesHref = getClinicHref(clinicId, 'branches');

  return (
    <section className="clinic-card clinic-dashboard-wide" aria-labelledby="branch-performance-title">
      <div className="clinic-card-header">
        <h3 id="branch-performance-title" className="clinic-card-title">Recent Branch Performance</h3>
        <a href={branchesHref} className="clinic-card-link">View All Branches</a>
      </div>
      <div className="clinic-table-scroll">
        <table className="clinic-table">
          <caption className="visually-hidden">Branch performance today and this month</caption>
          <thead>
            <tr>
              <th scope="col">Branch name</th>
              <th scope="col">Daily revenue</th>
              <th scope="col">Patient volume</th>
              <th scope="col">Appointments</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => {
              const status = branchStatus(branch);
              return (
                <tr key={branch.id}>
                  <td>
                    <div className="clinic-branch-cell">
                      <span className="clinic-branch-pin" aria-hidden="true"><Icon name="mapPin" size={16} /></span>
                      <span>
                        <span className="clinic-branch-name">{branch.name}</span>
                        {branch.is_main && <span className="clinic-chip">Main</span>}
                        <span className="clinic-branch-city">{branch.city}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    {peso(branch.revenue_today ?? 0)}
                    <span className="clinic-branch-city">{peso(branch.revenue_this_month)} this month</span>
                  </td>
                  <td>
                    {plural(branch.patients_this_month, 'patient', 'patients')}
                    <span className="clinic-branch-city">this month</span>
                  </td>
                  <td>
                    {count(branch.appointments_today)} today
                    <span className="clinic-branch-city">{count(branch.appointments_this_month)} this month</span>
                  </td>
                  <td><Badge tone={status.tone}>{status.label}</Badge></td>
                  <td className="clinic-table-action">
                    <BranchRowMenu branch={branch} clinicName={clinicName} />
                  </td>
                </tr>
              );
            })}
            {branches.length === 0 && (
              <tr>
                <td colSpan={6} className="portal-empty">No active branches yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const ALERT_TYPE_LABELS = { inventory: 'Inventory', appointments: 'Scheduling', reviews: 'Reviews' };

function alertAction(alert, clinicId) {
  if (alert.type === 'inventory' && alert.item_id) {
    const itemHref = `${getClinicHref(clinicId, 'inventory')}/${alert.item_id}`;
    return alert.title.startsWith('Low stock')
      ? { href: `${itemHref}?receive=1`, label: 'Reorder Now' }
      : { href: itemHref, label: 'Open item' };
  }
  if (alert.type === 'appointments') {
    return { href: `${getClinicHref(clinicId, 'appointments')}?status=${alert.status}`, label: 'Review' };
  }
  if (alert.type === 'reviews') return { href: getClinicHref(clinicId, 'reviews'), label: 'View reviews' };
  return null;
}

function ClinicalAlerts({ alerts }) {
  const { clinicId } = useClinic();
  const { user } = useAuth();
  const hidden = useDismissedAlerts(`clinic-alerts-dismissed:${user?.id ?? 'me'}:${clinicId}`);
  const visible = alerts.filter((alert) => !hidden.isDismissed(alertKey(alert)));
  const hiddenCount = alerts.length - visible.length;

  return (
    <section className="clinic-card clinic-alerts" aria-labelledby="clinical-alerts-title">
      <div className="clinic-card-header">
        <h3 id="clinical-alerts-title" className="clinic-card-title">
          <Icon name="alertTriangle" size={20} className="clinic-alerts-icon" />
          Clinical Alerts
        </h3>
        {visible.length > 0 && <span className="clinic-alerts-count">{visible.length} NEW</span>}
      </div>
      {visible.length === 0 ? (
        <p className="clinic-alerts-empty">All clear. Nothing needs attention right now.</p>
      ) : (
        <ul className="clinic-alert-list">
          {visible.map((alert) => {
            const action = alertAction(alert, clinicId);
            return (
              <li key={alertKey(alert)} className={`clinic-alert is-${alert.severity}`}>
                <span className={`clinic-alert-type is-${alert.type}`}>{ALERT_TYPE_LABELS[alert.type] ?? alert.type}</span>
                <p className="clinic-alert-title">{alert.title}</p>
                <p className="clinic-alert-message">{alert.message}</p>
                <div className="clinic-alert-actions">
                  {action && (
                    <a href={action.href} className="clinic-alert-action">
                      {action.label}
                    </a>
                  )}
                  <button
                    type="button"
                    className="clinic-alert-ignore"
                    onClick={() => hidden.dismiss(alertKey(alert))}
                    aria-label={`Ignore: ${alert.title}`}
                  >
                    Ignore
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {visible.length > 0 && (
        <button type="button" className="clinic-alerts-footer" onClick={() => hidden.dismissAll(visible.map(alertKey))}>
          Mark All as Read
        </button>
      )}
      {hiddenCount > 0 && (
        <button type="button" className="clinic-alerts-restore" onClick={hidden.restoreAll}>
          Show {hiddenCount} hidden {hiddenCount === 1 ? 'alert' : 'alerts'}
        </button>
      )}
      <a href={getClinicHref(clinicId, 'notifications')} className="clinic-alerts-link">
        View all notifications
      </a>
    </section>
  );
}

function TreatmentDistribution({ treatments }) {
  const max = Math.max(1, ...treatments.map((t) => t.total));
  return (
    <section className="clinic-card" aria-labelledby="treatments-title">
      <h3 id="treatments-title" className="clinic-card-title">Treatment Distribution</h3>
      <p className="clinic-card-subtitle">Appointments by service this month</p>
      {treatments.length === 0 ? (
        <p className="clinic-alerts-empty">No appointments booked this month yet.</p>
      ) : (
        <ul className="clinic-bars">
          {treatments.map((t) => (
            <li key={t.service} className="clinic-bar">
              <span className="clinic-bar-value">{t.total}</span>
              <span className="clinic-bar-track" aria-hidden="true">
                <span className="clinic-bar-fill" style={{ height: `${Math.max(6, (t.total / max) * 100)}%` }} />
              </span>
              <span className="clinic-bar-label">
                {t.service}
                <span className="visually-hidden">: {plural(t.total, 'appointment', 'appointments')}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BranchLocations({ branches, clinicName }) {
  const places = branches.map((b) => ({ ...b, place: branchPlace(b, clinicName) }));
  const pinned = places
    .filter(hasCoordinates)
    .map((b) => ({ ...b, position: projectToMap(b) }))
    .filter((b) => b.position);
  const mapSrc = pinned.length === 0 && places[0] ? embedUrl(places[0].place) : null;

  return (
    <section className="clinic-card clinic-locations" aria-labelledby="locations-title">
      <div className="clinic-card-header">
        <h3 id="locations-title" className="clinic-card-title">Branch Network</h3>
        <span className="clinic-chip is-soft">Bukidnon, Philippines</span>
      </div>
      {pinned.length > 0 ? (
        <div className="clinic-branch-map">
          <ul className="clinic-branch-map-pins" aria-label="Branch locations on the map">
            {pinned.map((b) => (
              <li key={b.id} className="clinic-branch-map-pin" style={{ left: `${b.position.x}%`, top: `${b.position.y}%` }}>
                <a
                  href={directionsUrl(b.place)}
                  target="_blank"
                  rel="noreferrer"
                  className={`clinic-branch-map-dot${b.open_now ? ' is-open' : ''}`}
                  aria-label={`${b.name}, ${b.open_now ? 'open now' : 'closed'}: directions`}
                >
                  {b.open_now && <span className="clinic-branch-map-ping" aria-hidden="true" />}
                </a>
                <span className="clinic-branch-map-label">
                  {b.name} ({b.open_now ? 'Open' : 'Closed'})
                </span>
              </li>
            ))}
          </ul>
          <p className="clinic-branch-map-note">Map preview (not to scale)</p>
        </div>
      ) : (
        mapSrc && (
          <iframe
            className="clinic-locations-map"
            title={`Map of ${places[0].name}`}
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )
      )}
      <ul className="clinic-location-list">
        {places.map((b) => (
          <li key={b.id} className="clinic-location">
            <span className={`clinic-location-dot${b.open_now ? ' is-open' : ''}`} aria-hidden="true" />
            <span className="clinic-location-text">
              <span className="clinic-branch-name">{b.name}</span>
              <span className="clinic-branch-city">
                {b.address}, {b.city} · {b.open_now ? 'Open now' : 'Closed'}
                {!hasCoordinates(b) && ' · no map location yet'}
              </span>
            </span>
            <a href={directionsUrl(b.place)} target="_blank" rel="noreferrer" className="clinic-card-link">
              Directions
            </a>
          </li>
        ))}
        {places.length === 0 && <li className="clinic-alerts-empty">No active branches yet.</li>}
      </ul>
    </section>
  );
}

function TodaySchedule({ appointments }) {
  const { clinicId } = useClinic();
  return (
    <Section
      title="Today's schedule"
      actions={<a href={getClinicHref(clinicId, 'appointments')} className="btn btn-outline btn-sm">All appointments</a>}
    >
      <DataTable
        caption="Today's appointments"
        rows={appointments}
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
              <a href={`${getClinicHref(clinicId, 'appointments')}/${a.id}`} aria-label={`Open appointment ${a.reference}`}>Open</a>
            ),
          },
        ]}
      />
    </Section>
  );
}

function RecentFeedback({ feedback }) {
  return (
    <Section title="Recent feedback" subtitle={feedback.rating ? `Average rating ${feedback.rating} / 5` : undefined}>
      <ul className="portal-list">
        {feedback.recent.map(toReview).map((review) => (
          <li key={review.id} className="portal-list-item">
            <strong>{review.rating}/5</strong> · {review.patientName} <Badge status={review.status} />
            {review.comment && <p className="portal-list-item-meta">{review.comment}</p>}
          </li>
        ))}
        {feedback.recent.length === 0 && <li className="portal-empty">No reviews yet.</li>}
      </ul>
    </Section>
  );
}

async function exportReport(clinicId, clinicName, overview) {
  const report = await getAppointmentReport(clinicId);
  const rows = [
    [`${clinicName} — appointment report`, `${report.from} to ${report.to}`],
    [],
  ];
  if (overview) {
    rows.push(['Summary', 'Value']);
    rows.push(['Appointments this month', overview.appointments.this_month]);
    rows.push(['Appointments last month', overview.appointments.last_month]);
    rows.push(['Estimated revenue this month (PHP)', overview.revenue_estimate.this_month]);
    rows.push(['Estimated revenue last month (PHP)', overview.revenue_estimate.last_month]);
    rows.push(['Revenue note', 'Estimate: listed price of each completed appointment']);
    rows.push([]);
  }
  rows.push(['Status', 'Appointments'], ...Object.entries(report.by_status ?? {}).map(([status, total]) => [status.replace(/_/g, ' '), total]), []);
  rows.push(['Service', 'Appointments'], ...(report.by_service ?? []).map((r) => [r.service, r.total]), []);
  rows.push(['Dentist', 'Appointments'], ...(report.by_dentist ?? []).map((r) => [r.dentist, r.total]), []);
  rows.push(['New patients', report.new_patients ?? 0]);
  rows.push(['Published reviews', report.reviews?.count ?? 0], ['Average rating', report.reviews?.average ?? 0]);
  if (overview) {
    rows.push([], ['Branch', 'Appointments this month', 'Patients this month', 'Estimated revenue (PHP)']);
    overview.branches.forEach((b) => rows.push([b.name, b.appointments_this_month, b.patients_this_month, b.revenue_this_month]));
  }
  downloadCsv(`clinic-report-${report.from}-to-${report.to}.csv`, rows);
}

function Dashboard() {
  const { clinicId, clinicName, can } = useClinic();
  const [exportState, setExportState] = useState({ busy: false, error: null });
  const query = useQuery({ queryKey: ['clinic', clinicId, 'dashboard'], queryFn: () => getClinicDashboard(clinicId) });

  const handleExport = async (overview) => {
    setExportState({ busy: true, error: null });
    try {
      await exportReport(clinicId, clinicName, overview);
      setExportState({ busy: false, error: null });
    } catch (error) {
      setExportState({ busy: false, error: getErrorMessage(error) });
    }
  };

  return (
    <QueryState query={query} loadingLabel="Loading dashboard…">
      {(data) => {
        const today = (data.appointments?.today ?? []).map(toAppointment);
        const overview = data.overview;

        return (
          <div className="clinic-dashboard">
            <div className="clinic-page-header">
              <div>
                <h2 className="clinic-page-title">Operations Overview</h2>
                <p className="clinic-page-subtitle">{updatedLabel(query.dataUpdatedAt)}</p>
              </div>
              <div className="portal-actions">
                {can('reports.view') && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExport(overview)} disabled={exportState.busy}>
                    <Icon name="download" size={16} />
                    {exportState.busy ? 'Preparing…' : 'Export Report'}
                  </button>
                )}
                {data.appointments && (
                  <a href={getClinicHref(clinicId, 'appointments')} className="btn btn-primary btn-sm">View Schedule</a>
                )}
              </div>
            </div>
            {exportState.error && <p className="portal-inline-error" role="alert">{exportState.error}</p>}

            <div className="clinic-metrics">
              {buildMetrics(data, clinicId).map(({ key, ...metric }) => (
                <MetricCard key={key} {...metric} />
              ))}
            </div>

            <div className="clinic-dashboard-row">
              {overview && <BranchPerformance branches={overview.branches} />}
              <ClinicalAlerts alerts={data.alerts ?? []} />
            </div>

            {overview && (
              <div className="clinic-dashboard-pair">
                <TreatmentDistribution treatments={overview.treatments} />
                <BranchLocations branches={overview.branches} clinicName={clinicName} />
              </div>
            )}

            {data.appointments && <TodaySchedule appointments={today} />}
            {data.feedback && <RecentFeedback feedback={data.feedback} />}
          </div>
        );
      }}
    </QueryState>
  );
}

/**
 * Sections from before the clinic admin design, kept under it so nothing is
 * lost: branch performance, alerts, treatments, branch network, today's
 * schedule and recent feedback.
 */
function OperationsDetails() {
  const { clinicId, clinicName } = useClinic();
  const [exportState, setExportState] = useState({ busy: false, error: null });
  const query = useQuery({ queryKey: ['clinic', clinicId, 'dashboard'], queryFn: () => getClinicDashboard(clinicId) });

  const handleExport = async (overview) => {
    setExportState({ busy: true, error: null });
    try {
      await exportReport(clinicId, clinicName, overview);
      setExportState({ busy: false, error: null });
    } catch (error) {
      setExportState({ busy: false, error: getErrorMessage(error) });
    }
  };

  return (
    <QueryState query={query} loadingLabel="Loading branch details…">
      {(data) => (
        <div className="clinic-dashboard">
          <div className="clinic-overview-details-head">
            <h2 className="clinic-card-soft-title">Branches &amp; Operations</h2>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExport(data.overview)} disabled={exportState.busy}>
              <Icon name="download" size={16} />
              {exportState.busy ? 'Preparing…' : 'Export Report'}
            </button>
          </div>
          {exportState.error && <p className="portal-inline-error" role="alert">{exportState.error}</p>}
          <div className="clinic-dashboard-row">
            {data.overview && <BranchPerformance branches={data.overview.branches} />}
            <ClinicalAlerts alerts={data.alerts ?? []} />
          </div>
          {data.overview && (
            <div className="clinic-dashboard-pair">
              <TreatmentDistribution treatments={data.overview.treatments} />
              <BranchLocations branches={data.overview.branches} clinicName={clinicName} />
            </div>
          )}
          {data.appointments && <TodaySchedule appointments={(data.appointments.today ?? []).map(toAppointment)} />}
          {data.feedback && <RecentFeedback feedback={data.feedback} />}
        </div>
      )}
    </QueryState>
  );
}

// Dentists get their own overview (dentist design), clinic admins the admin
// design (it needs reports.view), other roles the operations dashboard.
function DashboardForRole() {
  const { membership, can } = useClinic();
  if (isDentistMember(membership)) return <DentistOverview />;
  if (!can('reports.view')) return <Dashboard />;
  return (
    <ClinicAdminOverview>
      <OperationsDetails />
    </ClinicAdminOverview>
  );
}

function ClinicDashboardPage() {
  const { clinicId } = useParams();
  const { memberships } = useAuth();
  const membership = memberships.find((m) => String(m.clinic_id) === String(clinicId));
  const isDentist = isDentistMember(membership);

  return (
    <ClinicLayout section="dashboard" title={isDentist ? 'Overview' : 'Dashboard'} hideSearch={!isDentist} showWalkIn>
      <DashboardForRole />
    </ClinicLayout>
  );
}

export default ClinicDashboardPage;
