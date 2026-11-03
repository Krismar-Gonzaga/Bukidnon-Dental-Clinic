// Operations Overview for phones (clinic admin design, mobile layout).
// Owners see month figures, branch activity and services; other roles see
// what their permissions cover. Alerts come from the same dashboard API and
// open the page that resolves them, as on the web dashboard.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ClinicScreen, useOpenSection } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { alertKey, useDismissedAlerts } from '../../components/clinic/useDismissedAlerts';
import { useAuth } from '../../context/AuthContext';
import { isNetworkError } from '../../services/api';
import {
  BranchOverview,
  can,
  ClinicAlert,
  ClinicDashboard,
  fetchAppointmentReport,
  fetchClinicDashboard,
  formatCount,
  formatPeso,
  monthChange,
  serverMessage,
} from '../../services/clinicPortal';
import { formatClockTime } from '../../services/booking';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';
import { ClinicRoute } from '../../config/clinicSections';
import { ClinicAdminOverview } from './ClinicAdminOverview';
import DentistOverview from './DentistOverview';

type Metric = {
  key: string;
  label: string;
  value: string;
  icon: string;
  change?: { text: string; direction: 'up' | 'down' | 'flat' };
  note?: string;
  highlight?: boolean;
  /** Page that lists what the figure counts. */
  link?: { route: ClinicRoute; params?: Record<string, unknown> };
};

type Open = (route: ClinicRoute, params?: Record<string, unknown>) => void;

const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

function buildMetrics(data: ClinicDashboard): Metric[] {
  const a = data.appointments;
  const pending: Metric | null = a
    ? {
        key: 'pending',
        label: 'Pending requests',
        value: formatCount(a.pending_requests),
        icon: 'checkmark-done-outline',
        highlight: true,
        note: a.pending_requests ? 'Waiting for confirmation' : 'Nothing waiting',
        link: { route: 'ClinicAppointments', params: { status: 'pending' } },
      }
    : null;

  const o = data.overview;
  if (o) {
    return [
      { key: 'appointments', label: 'Total appointments', value: formatCount(o.appointments.this_month), icon: 'calendar-outline', change: monthChange(o.appointments.this_month, o.appointments.last_month) },
      { key: 'revenue', label: 'Est. revenue', value: formatPeso(o.revenue_estimate.this_month), icon: 'cash-outline', change: monthChange(o.revenue_estimate.this_month, o.revenue_estimate.last_month), note: 'Completed visits × price' },
      { key: 'staff', label: 'Active staff', value: formatCount(o.staff.active), icon: 'people-outline', note: `${plural(o.staff.dentists, 'dentist', 'dentists')} · ${plural(o.branches.length, 'branch', 'branches')}`, link: { route: 'ClinicStaff' } },
      ...(pending ? [pending] : []),
    ];
  }

  return [
    a && { key: 'today', label: "Today's appointments", value: formatCount(a.today.length), icon: 'calendar-outline', link: { route: 'ClinicAppointments' } },
    pending,
    a && { key: 'upcoming', label: 'Upcoming', value: formatCount(a.upcoming), icon: 'time-outline' },
    a && { key: 'completed', label: 'Completed this month', value: formatCount(a.completed_this_month), icon: 'checkmark-circle-outline' },
    data.inventory && { key: 'low', label: 'Low-stock items', value: formatCount(data.inventory.low_stock), icon: 'cube-outline', highlight: !a, link: { route: 'ClinicInventory', params: { lowStock: true } } },
    data.inventory && { key: 'expiring', label: 'Expiring soon', value: formatCount(data.inventory.near_expiry), icon: 'warning-outline' },
    data.inventory && { key: 'expired', label: 'Expired batches', value: formatCount(data.inventory.expired), icon: 'alert-circle-outline' },
  ].filter(Boolean) as Metric[];
}

function MetricCard({ metric, onOpen }: { metric: Metric; onOpen?: () => void }) {
  const light = metric.highlight;
  const changeColor =
    metric.change?.direction === 'up' ? palette.secondary : metric.change?.direction === 'down' ? palette.error : palette.onSurfaceVariant;
  return (
    <TouchableOpacity
      style={[styles.metric, light && styles.metricHighlight]}
      onPress={onOpen}
      disabled={!onOpen}
      activeOpacity={0.8}
      accessibilityRole={onOpen ? 'button' : undefined}
      accessibilityLabel={`${metric.label}: ${metric.value}`}
    >
      <Icon name={metric.icon} size={72} style={[styles.metricBgIcon, light && styles.metricBgIconLight]} />
      <Text style={[styles.metricLabel, light && styles.metricLabelLight]} numberOfLines={2}>
        {metric.label}
      </Text>
      <Text style={[styles.metricValue, light && styles.textOnPrimary]} numberOfLines={1} adjustsFontSizeToFit>
        {metric.value}
      </Text>
      {metric.change && (
        <View style={styles.metricRow}>
          {metric.change.direction !== 'flat' && (
            <Icon name={metric.change.direction === 'up' ? 'trending-up' : 'trending-down'} size={14} color={changeColor} />
          )}
          <Text style={[styles.metricChange, { color: changeColor }]}>{metric.change.text}</Text>
        </View>
      )}
      {metric.note && <Text style={[styles.metricNote, light && styles.textOnPrimary]}>{metric.note}</Text>}
    </TouchableOpacity>
  );
}

const directions = (clinicName: string, b: BranchOverview) => {
  const destination = b.latitude != null && b.longitude != null ? `${b.latitude},${b.longitude}` : `${clinicName} ${b.name}, ${b.address}, ${b.city}`;
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`);
};

function BranchCard({ branch, clinicName, open, canManage, canSchedule }: { branch: BranchOverview; clinicName: string; open: Open; canManage: boolean; canSchedule: boolean }) {
  const status = branch.open_now ? 'Open now' : branch.hours_today ? 'Closed now' : 'Closed today';
  return (
    <View style={styles.branch}>
      <View style={styles.branchHeader}>
        <View style={styles.branchPin}>
          <Icon name="location-outline" size={16} color={palette.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.branchName}>
            {branch.name}
            {branch.is_main ? '  ·  Main' : ''}
          </Text>
          <Text style={styles.muted}>{branch.city}</Text>
        </View>
        <View style={[styles.statusPill, branch.open_now ? styles.statusOpen : styles.statusClosed]}>
          <Text style={[styles.statusText, branch.open_now ? styles.statusTextOpen : styles.statusTextClosed]}>{status}</Text>
        </View>
      </View>
      <View style={styles.branchStats}>
        <BranchStat label="Daily revenue" value={formatPeso(branch.revenue_today ?? 0)} />
        <BranchStat label="Visits today" value={formatCount(branch.appointments_today)} />
        <BranchStat label="Patients (month)" value={formatCount(branch.patients_this_month)} />
        <BranchStat label="Month revenue" value={formatPeso(branch.revenue_this_month)} />
      </View>
      {branch.hours_today && (
        <Text style={styles.branchHours}>
          Today: {formatClockTime(branch.hours_today.opens_at)} – {formatClockTime(branch.hours_today.closes_at)}
        </Text>
      )}
      <View style={styles.branchActions}>
        {canManage && <LinkButton icon="create-outline" label="Manage" onPress={() => open('ClinicBranches', { branchId: branch.id })} />}
        {canSchedule && <LinkButton icon="calendar-outline" label="Schedule" onPress={() => open('ClinicAppointments')} />}
        <LinkButton icon="navigate-outline" label="Directions" onPress={() => directions(clinicName, branch)} />
      </View>
    </View>
  );
}

const LinkButton = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.linkButton} onPress={onPress} accessibilityRole="button">
    <Icon name={icon} size={16} color={palette.primary} />
    <Text style={styles.linkButtonText}>{label}</Text>
  </TouchableOpacity>
);

const BranchStat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.branchStat}>
    <Text style={styles.branchStatValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    <Text style={styles.branchStatLabel}>{label}</Text>
  </View>
);

const ALERT_TYPE_LABELS: Record<ClinicAlert['type'], string> = { inventory: 'Inventory', appointments: 'Scheduling', reviews: 'Reviews' };

/** What resolves an alert, as on the web dashboard. */
function useAlertAction() {
  const navigation = useNavigation<any>();
  const open = useOpenSection('ClinicDashboard');
  return (alert: ClinicAlert): { label: string; run: () => void } | null => {
    if (alert.type === 'inventory' && alert.item_id) {
      const reorder = alert.title.startsWith('Low stock');
      return {
        label: reorder ? 'Reorder Now' : 'Open item',
        run: () => navigation.navigate('ClinicInventoryItem', { itemId: alert.item_id, receive: reorder }),
      };
    }
    if (alert.type === 'appointments') return { label: 'Review', run: () => open('ClinicAppointments', { status: alert.status }) };
    if (alert.type === 'reviews') return { label: 'View reviews', run: () => open('ClinicReviews') };
    return null;
  };
}

function AlertCard({ alert, onIgnore }: { alert: ClinicAlert; onIgnore: () => void }) {
  const action = useAlertAction()(alert);
  const border = alert.severity === 'danger' ? palette.error : alert.severity === 'warning' ? '#b7791f' : palette.primary;
  return (
    <View style={[styles.alert, { borderLeftColor: border }]}>
      <Text style={[styles.alertType, alert.type === 'inventory' ? styles.alertTypeInventory : alert.type === 'appointments' ? styles.alertTypeSchedule : null]}>
        {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
      </Text>
      <Text style={styles.alertTitle}>{alert.title}</Text>
      <Text style={styles.alertMessage}>{alert.message}</Text>
      <View style={styles.alertActions}>
        {action && (
          <TouchableOpacity style={styles.alertPrimary} onPress={action.run} accessibilityRole="button">
            <Text style={styles.alertPrimaryText}>{action.label}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.alertIgnore} onPress={onIgnore} accessibilityRole="button" accessibilityLabel={`Ignore: ${alert.title}`}>
          <Text style={styles.alertIgnoreText}>Ignore</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ClinicalAlerts({ alerts, clinicId }: { alerts: ClinicAlert[]; clinicId: number }) {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const hidden = useDismissedAlerts(`clinic-alerts-dismissed:${user?.id ?? 'me'}:${clinicId}`);
  const visible = alerts.filter((a) => !hidden.isDismissed(alertKey(a)));
  const hiddenCount = alerts.length - visible.length;

  return (
    <View style={styles.alertsCard}>
      <View style={styles.alertsHeader}>
        <Icon name="warning-outline" size={20} color={palette.error} />
        <Text style={styles.alertsTitle}>Clinical Alerts</Text>
        {visible.length > 0 && <Text style={styles.alertsCount}>{visible.length} NEW</Text>}
      </View>
      {visible.length === 0 ? (
        <Text style={styles.muted}>All clear. Nothing needs attention right now.</Text>
      ) : (
        visible.map((alert) => <AlertCard key={alertKey(alert)} alert={alert} onIgnore={() => hidden.dismiss(alertKey(alert))} />)
      )}
      <View style={styles.alertsFooter}>
        {visible.length > 0 && <LinkButton icon="checkmark-done-outline" label="Mark All as Read" onPress={() => hidden.dismissAll(visible.map(alertKey))} />}
        {hiddenCount > 0 && <LinkButton icon="eye-outline" label={`Show ${hiddenCount} hidden`} onPress={hidden.restoreAll} />}
        <LinkButton icon="notifications-outline" label="All notifications" onPress={() => navigation.navigate('ClinicNotifications')} />
      </View>
    </View>
  );
}

const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** The web dashboard's Export Report, shared as CSV text from the phone. */
async function shareReport(clinicId: number, clinicName: string, overview: ClinicDashboard['overview']) {
  const report = await fetchAppointmentReport(clinicId);
  const rows: unknown[][] = [[`${clinicName} — appointment report`, `${report.from} to ${report.to}`], []];
  if (overview) {
    rows.push(
      ['Summary', 'Value'],
      ['Appointments this month', overview.appointments.this_month],
      ['Appointments last month', overview.appointments.last_month],
      ['Estimated revenue this month (PHP)', overview.revenue_estimate.this_month],
      ['Estimated revenue last month (PHP)', overview.revenue_estimate.last_month],
      ['Revenue note', 'Estimate: listed price of each completed appointment'],
      [],
    );
  }
  rows.push(['Status', 'Appointments'], ...Object.entries(report.by_status ?? {}).map(([s, total]) => [s.replace(/_/g, ' '), total]), []);
  rows.push(['Service', 'Appointments'], ...(report.by_service ?? []).map((r) => [r.service, r.total]), []);
  rows.push(['Dentist', 'Appointments'], ...(report.by_dentist ?? []).map((r) => [r.dentist, r.total]), []);
  rows.push(['New patients', report.new_patients ?? 0], ['Published reviews', report.reviews?.count ?? 0], ['Average rating', report.reviews?.average ?? 0]);
  if (overview) {
    rows.push([], ['Branch', 'Appointments this month', 'Patients this month', 'Estimated revenue (PHP)']);
    overview.branches.forEach((b) => rows.push([b.name, b.appointments_this_month, b.patients_this_month, b.revenue_this_month]));
  }
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  await Share.share({ title: `clinic-report-${report.from}-to-${report.to}.csv`, message: csv });
}

const OperationsDashboard = () => {
  const navigation = useNavigation<any>();
  const open = useOpenSection('ClinicDashboard');
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id;
  const [data, setData] = useState<ClinicDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);
  const canViewAppointments = can(membership, 'appointments.view_all', 'appointments.view_assigned');
  const isAdmin = can(membership, 'reports.view');
  const [reloadKey, setReloadKey] = useState(0);

  const exportReport = async () => {
    if (!clinicId) return;
    setExporting(true);
    try {
      await shareReport(clinicId, membership?.clinic_name ?? 'Clinic', data?.overview);
    } catch (err) {
      Alert.alert('Report not exported', serverMessage(err, 'Please try again.'));
    } finally {
      setExporting(false);
    }
  };

  const load = useCallback(async () => {
    if (!clinicId) return;
    try {
      setData(await fetchClinicDashboard(clinicId));
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      setError(isNetworkError(err) ? "You're offline. The dashboard needs a connection." : 'The dashboard could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clinicId]);

  useEffect(() => {
    setLoading(true);
  }, [clinicId]);

  // Load on open and refresh quietly when coming back from another page.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const treatmentsMax = Math.max(1, ...(data?.overview?.treatments ?? []).map((t) => t.total));

  return (
    <ClinicScreen title="Dashboard" active="ClinicDashboard">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setReloadKey((n) => n + 1); load(); }} colors={[palette.primary]} />}
      >
        {isAdmin && membership && <ClinicAdminOverview membership={membership} reloadKey={reloadKey} />}
        <View style={styles.headingRow}>
          <View style={styles.flex}>
            <Text style={styles.heading}>{isAdmin ? 'Branches & Operations' : 'Operations Overview'}</Text>
            {updatedAt && (
              <Text style={styles.muted}>
                Last updated: Today, {updatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </Text>
            )}
          </View>
          {can(membership, 'reports.view') && data && (
            <TouchableOpacity style={styles.exportButton} onPress={exportReport} disabled={exporting} accessibilityRole="button" accessibilityLabel="Export report">
              {exporting ? <ActivityIndicator size="small" color={palette.primary} /> : <Icon name="share-outline" size={18} color={palette.primary} />}
              <Text style={styles.exportText}>{exporting ? 'Preparing…' : 'Export'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loading} size="large" color={palette.primary} />
        ) : error && !data ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); load(); }} accessibilityRole="button">
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : data ? (
          <>
            {error && <Text style={styles.errorText}>{error}</Text>}
            {!isAdmin && (
              <View style={styles.metrics}>
                {buildMetrics(data).map((m) => (
                  <MetricCard
                    key={m.key}
                    metric={m}
                    onOpen={m.link && can(membership, ...linkPermissions(m.link.route)) ? () => open(m.link!.route, m.link!.params) : undefined}
                  />
                ))}
              </View>
            )}

            {data.overview && (
              <>
                <Text style={styles.sectionTitle}>Recent Branch Performance</Text>
                {data.overview.branches.map((b) => (
                  <BranchCard
                    key={b.id}
                    branch={b}
                    clinicName={membership?.clinic_name ?? ''}
                    open={open}
                    canManage={can(membership, 'clinic.branches.manage', 'clinic.schedules.manage')}
                    canSchedule={canViewAppointments}
                  />
                ))}
                {data.overview.branches.length === 0 && <Text style={styles.muted}>No active branches yet.</Text>}
              </>
            )}

            {clinicId && <ClinicalAlerts alerts={data.alerts} clinicId={clinicId} />}

            {data.overview && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Treatment Distribution</Text>
                <Text style={styles.muted}>Appointments by service this month</Text>
                {data.overview.treatments.length === 0 ? (
                  <Text style={[styles.muted, styles.spaced]}>No appointments booked this month yet.</Text>
                ) : (
                  data.overview.treatments.map((t) => (
                    <View key={t.service} style={styles.bar} accessible accessibilityLabel={`${t.service}: ${plural(t.total, 'appointment', 'appointments')}`}>
                      <View style={styles.barLabels}>
                        <Text style={styles.barLabel} numberOfLines={1}>{t.service}</Text>
                        <Text style={styles.barValue}>{t.total}</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${Math.max(4, (t.total / treatmentsMax) * 100)}%` }]} />
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {data.appointments && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Today's schedule</Text>
                {data.appointments.today.length === 0 ? (
                  <Text style={[styles.muted, styles.spaced]}>No appointments today.</Text>
                ) : (
                  data.appointments.today.map((appt) => (
                    <TouchableOpacity
                      key={appt.id}
                      style={styles.appt}
                      disabled={!canViewAppointments}
                      onPress={() => navigation.navigate('ClinicAppointmentDetail', { appointmentId: appt.id })}
                      accessibilityRole="button"
                    >
                      <Text style={styles.apptTime}>{formatClockTime(appt.appointment_time)}</Text>
                      <View style={styles.flex}>
                        <Text style={styles.apptPatient}>{appt.patient?.name ?? 'Patient'}</Text>
                        <Text style={styles.muted}>
                          {appt.service?.name ?? 'Service'}
                          {appt.dentist?.name ? ` · ${appt.dentist.name}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.apptStatus}>{appt.status.replace(/_/g, ' ')}</Text>
                    </TouchableOpacity>
                  ))
                )}
                {canViewAppointments && <LinkButton icon="calendar-outline" label="All appointments" onPress={() => open('ClinicAppointments')} />}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </ClinicScreen>
  );
};

// Dentists get their own overview (dentist design); other roles the operations dashboard.
const ClinicDashboardScreen = () => {
  const { membership } = useClinicPortal();
  if (membership?.role !== 'dentist') return <OperationsDashboard />;
  return (
    <ClinicScreen title="Overview" active="ClinicDashboard">
      <DentistOverview />
    </ClinicScreen>
  );
};

/** Permissions of the page a metric links to (see config/clinicSections). */
const linkPermissions = (route: ClinicRoute) =>
  ({
    ClinicAppointments: ['appointments.view_all', 'appointments.view_assigned'],
    ClinicStaff: ['clinic.staff.manage'],
    ClinicInventory: ['inventory.view'],
  })[route as string] ?? ['clinic.view'];

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  flex: { flex: 1 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heading: { ...type.headlineLgMobile, color: palette.onSurface },
  exportButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, minHeight: 40, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest },
  exportText: { ...type.labelMd, color: palette.primary },
  branchHours: { fontSize: 12, color: palette.onSurfaceVariant, marginTop: spacing.sm },
  branchActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: spacing.base },
  linkButtonText: { ...type.labelMd, color: palette.primary },
  alertActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  alertPrimary: { paddingHorizontal: spacing.sm, minHeight: 36, justifyContent: 'center', borderRadius: radius.lg, backgroundColor: palette.primary },
  alertPrimaryText: { ...type.labelMd, color: palette.onPrimary },
  alertIgnore: { paddingHorizontal: spacing.sm, minHeight: 36, justifyContent: 'center' },
  alertIgnoreText: { ...type.labelMd, color: palette.onSurfaceVariant },
  alertsFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  muted: { ...type.bodyMd, color: palette.onSurfaceVariant },
  spaced: { marginTop: spacing.sm },
  loading: { marginTop: spacing.xl },
  errorBox: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: palette.errorContainer, gap: spacing.sm },
  errorText: { ...type.bodyMd, color: palette.onErrorContainer },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.base, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: palette.primary, minHeight: 44, justifyContent: 'center' },
  retryText: { color: palette.onPrimary, fontWeight: '600' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: {
    width: '48%',
    flexGrow: 1,
    overflow: 'hidden',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(194,198,212,0.3)',
    backgroundColor: palette.surfaceContainerLowest,
    ...shadow.sm,
  },
  metricHighlight: { backgroundColor: palette.primary, borderColor: palette.primary },
  metricBgIcon: { position: 'absolute', right: -12, bottom: -12, color: palette.primary, opacity: 0.06 },
  metricBgIconLight: { color: palette.onPrimary, opacity: 0.12 },
  metricLabel: { ...type.labelMd, color: palette.onSurfaceVariant, textTransform: 'uppercase' },
  metricLabelLight: { color: palette.primaryFixed },
  metricValue: { fontSize: 30, lineHeight: 38, fontWeight: '700', color: palette.onSurface, marginTop: spacing.xs },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  metricChange: { ...type.labelMd, letterSpacing: 0 },
  metricNote: { ...type.labelMd, letterSpacing: 0, color: palette.onSurfaceVariant, marginTop: spacing.xs },
  textOnPrimary: { color: palette.onPrimary },
  sectionTitle: { ...type.titleLg, color: palette.onSurface, marginTop: spacing.sm },
  branch: { padding: spacing.md, borderRadius: radius.xxl, backgroundColor: palette.surfaceContainerLowest, borderWidth: 1, borderColor: 'rgba(194,198,212,0.3)', ...shadow.sm },
  branchHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  branchPin: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: 'rgba(0,86,179,0.12)', alignItems: 'center', justifyContent: 'center' },
  branchName: { ...type.bodyLg, fontWeight: '600', color: palette.onSurface },
  statusPill: { paddingHorizontal: spacing.base, paddingVertical: 4, borderRadius: radius.full },
  statusOpen: { backgroundColor: 'rgba(103,252,198,0.35)' },
  statusClosed: { backgroundColor: palette.surfaceContainerHigh },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statusTextOpen: { color: palette.onSecondaryContainer },
  statusTextClosed: { color: palette.onSurfaceVariant },
  branchStats: { flexDirection: 'row', marginTop: spacing.md, borderTopWidth: 1, borderTopColor: palette.surfaceContainerHigh, paddingTop: spacing.sm },
  branchStat: { flex: 1, alignItems: 'center' },
  branchStatValue: { ...type.bodyLg, fontWeight: '700', color: palette.onSurface },
  branchStatLabel: { fontSize: 11, color: palette.onSurfaceVariant },
  alertsCard: { padding: spacing.md, borderRadius: radius.xxl, backgroundColor: palette.surfaceContainerLow, borderWidth: 1, borderColor: 'rgba(194,198,212,0.3)', gap: spacing.sm },
  alertsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  alertsTitle: { ...type.titleLg, color: palette.onSurface, flex: 1 },
  alertsCount: { backgroundColor: palette.error, color: palette.onPrimary, fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  alert: { padding: spacing.md, borderRadius: radius.xl, backgroundColor: 'rgba(255,255,255,0.8)', borderLeftWidth: 4 },
  alertType: { alignSelf: 'flex-start', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: palette.primaryFixed, color: '#001a40', marginBottom: spacing.xs },
  alertTypeInventory: { backgroundColor: palette.errorContainer, color: palette.onErrorContainer },
  alertTypeSchedule: { backgroundColor: palette.secondaryContainer, color: palette.onSecondaryContainer },
  alertTitle: { ...type.bodyMd, fontWeight: '600', color: palette.onSurface },
  alertMessage: { fontSize: 12, color: palette.onSurfaceVariant, marginTop: 2 },
  card: { padding: spacing.md, borderRadius: radius.xxl, backgroundColor: palette.surfaceContainerLowest, borderWidth: 1, borderColor: 'rgba(194,198,212,0.3)', ...shadow.sm },
  cardTitle: { ...type.titleLg, color: palette.onSurface },
  bar: { marginTop: spacing.sm },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { ...type.bodyMd, color: palette.onSurface, flex: 1 },
  barValue: { ...type.labelMd, color: palette.primary },
  barTrack: { height: 10, borderRadius: radius.full, backgroundColor: palette.surfaceContainerHigh, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.full, backgroundColor: palette.primary, opacity: 0.8 },
  appt: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: palette.surfaceContainerHigh },
  apptTime: { ...type.labelMd, color: palette.primary, width: 64 },
  apptPatient: { ...type.bodyMd, fontWeight: '600', color: palette.onSurface },
  apptStatus: { fontSize: 11, color: palette.onSurfaceVariant, textTransform: 'capitalize' },
});

export default ClinicDashboardScreen;
