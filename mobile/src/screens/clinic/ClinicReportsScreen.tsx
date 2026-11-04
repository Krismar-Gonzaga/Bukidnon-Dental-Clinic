// Reports & Analytics (web: ClinicReportsPage): the design's five tabs for the
// current year, and any date range under Appointments. Aggregate figures only, no
// patient-level details. Revenue is an estimate (listed price of completed visits).
import React, { useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, Button, Card, Chips, EmptyState, FormError, InfoRow, LoadState, StatGrid, ui, useLoader } from '../../components/clinic/ClinicUi';
import { DateField } from '../../components/clinic/DateField';
import {
  fetchAppointmentReport,
  fetchInventoryItems,
  fetchReportAnalytics,
  formatCount,
  formatPeso,
  InventoryItem,
  ReportAnalytics,
  serverMessage,
  statusLabel,
  stockStatus,
} from '../../services/clinicPortal';
import { toBusinessDateKey } from '../../services/booking';
import { palette, radius, spacing, type } from '../../theme/tokens';

type Tab = 'appointments' | 'revenue' | 'treatments' | 'patients' | 'inventory';

const TABS: { id: Tab; label: string }[] = [
  { id: 'appointments', label: 'Appointments' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'treatments', label: 'Treatments' },
  { id: 'patients', label: 'Patients' },
  { id: 'inventory', label: 'Inventory' },
];

const CANCELLED_COLOR = '#f87171';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
const rate = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 1000) / 10}% rate` : 'No data yet');

const SummaryCards = ({ cards }: { cards: { label: string; value: string; note: string }[] }) => (
  <View style={styles.cards}>
    {cards.map((card) => (
      <View key={card.label} style={styles.card}>
        <Text style={styles.cardValue} numberOfLines={1}>{card.value}</Text>
        <Text style={styles.cardLabel}>{card.label}</Text>
        <Text style={styles.cardNote}>{card.note}</Text>
      </View>
    ))}
  </View>
);

/** Plain views: the app has no chart library. A phone reads rows better than twelve columns. */
function Bars({ rows }: { rows: { key: string; label: string; value: number; display: string }[] }) {
  const highest = Math.max(1, ...rows.map((row) => row.value));
  return (
    <>
      {rows.map((row) => (
        <View key={row.key} style={styles.bar} accessible accessibilityLabel={`${row.label}: ${row.display}`}>
          <Text style={styles.barLabel} numberOfLines={2}>{row.label}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(row.value / highest) * 100}%`, backgroundColor: palette.primary }]} />
          </View>
          <Text style={styles.barValue}>{row.display}</Text>
        </View>
      ))}
    </>
  );
}

function MonthTrend({ months }: { months: ReportAnalytics['months'] }) {
  const highest = Math.max(1, ...months.map((m) => m.confirmed + m.cancelled));
  return (
    <>
      <View style={ui.row}>
        <View style={[styles.legendDot, { backgroundColor: palette.primary }]} />
        <Text style={ui.small}>Confirmed</Text>
        <View style={[styles.legendDot, { backgroundColor: CANCELLED_COLOR }]} />
        <Text style={ui.small}>Cancelled</Text>
      </View>
      {months.map((m) => (
        <View key={m.month} style={styles.bar} accessible accessibilityLabel={`${monthName(m.month)}: ${m.confirmed} confirmed, ${m.cancelled} cancelled`}>
          <Text style={styles.barLabel}>{monthName(m.month)}</Text>
          <View style={[styles.track, styles.trackRow]}>
            <View style={[styles.segment, { width: `${(m.confirmed / highest) * 100}%`, backgroundColor: palette.primary }]} />
            <View style={[styles.segment, { width: `${(m.cancelled / highest) * 100}%`, backgroundColor: CANCELLED_COLOR }]} />
          </View>
          <Text style={styles.barValue}>
            {formatCount(m.confirmed)} / {formatCount(m.cancelled)}
          </Text>
        </View>
      ))}
    </>
  );
}

function CustomRange({ clinicId }: { clinicId: number }) {
  const today = toBusinessDateKey(new Date());
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const validRange = Boolean(from && to && from <= to);
  const report = useLoader(() => (validRange ? fetchAppointmentReport(clinicId, from, to) : Promise.resolve(null)), [clinicId, from, to, validRange], 'The report could not be built.');
  const data = report.data;

  return (
    <Card title="Custom date range" subtitle="Counts for the chosen dates (Philippine time).">
      <DateField label="From" value={from} onChange={(v) => v && setFrom(v)} />
      <DateField label="To" value={to} onChange={(v) => v && setTo(v)} />
      {!validRange && <FormError message="The start date must be on or before the end date." />}
      <LoadState loading={report.loading} error={data ? null : report.error} onRetry={report.reload} />
      {data && (
        <>
          <StatGrid
            stats={[
              ...Object.entries(data.by_status).map(([status, total]) => ({ label: statusLabel(status), value: total })),
              { label: 'New patients', value: data.new_patients, icon: 'person-add-outline' },
              { label: 'Reviews', value: data.reviews.count, icon: 'chatbox-outline' },
              { label: 'Average rating', value: data.reviews.count ? data.reviews.average : '—', icon: 'star-outline' },
            ]}
          />
          <Text style={ui.title}>By service</Text>
          {data.by_service.length === 0 ? <EmptyState text="No appointments." /> : data.by_service.map((r) => <InfoRow key={r.service} label={r.service} value={r.total} />)}
          <Text style={ui.title}>By dentist</Text>
          {data.by_dentist.length === 0 ? <EmptyState text="No appointments." /> : data.by_dentist.map((r) => <InfoRow key={r.dentist} label={r.dentist} value={r.total} />)}
        </>
      )}
    </Card>
  );
}

function AppointmentsTab({ data, clinicId }: { data: ReportAnalytics; clinicId: number }) {
  const { totals, year, months } = data;
  return (
    <>
      <SummaryCards
        cards={[
          { label: 'Total', value: formatCount(totals.appointments), note: 'Year to date' },
          { label: 'Confirmed', value: formatCount(totals.confirmed), note: rate(totals.confirmed, totals.appointments) },
          { label: 'Cancelled', value: formatCount(totals.cancelled), note: rate(totals.cancelled, totals.appointments) },
          { label: 'Avg / Day', value: totals.active_days ? (totals.appointments / totals.active_days).toFixed(1) : '0', note: 'Days with appointments' },
        ]}
      />
      <Card title={`Monthly Appointment Trend (${year})`}>
        <MonthTrend months={months} />
      </Card>
      <CustomRange clinicId={clinicId} />
    </>
  );
}

function RevenueTab({ data }: { data: ReportAnalytics }) {
  const { totals, year, months, currency } = data;
  const thisMonth = months[months.length - 1]?.revenue ?? 0;
  const lastMonth = months[months.length - 2]?.revenue ?? 0;
  return (
    <>
      <SummaryCards
        cards={[
          { label: 'Revenue', value: formatPeso(totals.revenue), note: `Year to date (${currency}, estimate)` },
          { label: 'This Month', value: formatPeso(thisMonth), note: 'Completed visits × listed price' },
          { label: 'Last Month', value: formatPeso(lastMonth), note: 'Completed visits × listed price' },
          { label: 'Avg / Visit', value: formatPeso(totals.completed_visits ? totals.revenue / totals.completed_visits : 0), note: `${formatCount(totals.completed_visits)} completed visits` },
        ]}
      />
      <Card title={`Monthly Revenue (${year})`}>
        <Bars rows={months.map((m) => ({ key: m.month, label: monthName(m.month), value: m.revenue, display: formatPeso(m.revenue) }))} />
      </Card>
    </>
  );
}

function TreatmentsTab({ data }: { data: ReportAnalytics }) {
  const { treatments, year } = data;
  const total = treatments.reduce((sum, t) => sum + t.total, 0);
  const top = treatments[0];
  return (
    <>
      <SummaryCards
        cards={[
          { label: 'Treatments', value: formatCount(total), note: 'Booked, year to date' },
          { label: 'Services Used', value: formatCount(treatments.length), note: 'Different services' },
          { label: 'Most Booked', value: top ? formatCount(top.total) : '0', note: top?.service ?? 'No bookings yet' },
          { label: 'Top Share', value: top && total ? `${Math.round((top.total / total) * 100)}%` : '0%', note: 'Of all treatments' },
        ]}
      />
      <Card title={`Treatments by Service (${year})`}>
        {treatments.length === 0 ? (
          <EmptyState text="No treatments booked yet this year." />
        ) : (
          <Bars rows={treatments.map((t) => ({ key: t.service, label: t.service, value: t.total, display: `${formatCount(t.total)} · ${formatPeso(t.revenue)}` }))} />
        )}
      </Card>
    </>
  );
}

function PatientsTab({ data }: { data: ReportAnalytics }) {
  const { totals, year, months } = data;
  const thisMonth = months[months.length - 1]?.new_patients ?? 0;
  return (
    <>
      <SummaryCards
        cards={[
          { label: 'Total Patients', value: formatCount(totals.patients), note: 'Registered with this clinic' },
          { label: 'New', value: formatCount(totals.new_patients), note: 'Year to date' },
          { label: 'New This Month', value: formatCount(thisMonth), note: 'Registered this month' },
          { label: 'Avg New / Month', value: months.length ? (totals.new_patients / months.length).toFixed(1) : '0', note: 'Year to date' },
        ]}
      />
      <Card title={`New Patients by Month (${year})`}>
        <Bars rows={months.map((m) => ({ key: m.month, label: monthName(m.month), value: m.new_patients, display: formatCount(m.new_patients) }))} />
      </Card>
    </>
  );
}

function InventoryTab({ clinicId }: { clinicId: number }) {
  const items = useLoader(() => fetchInventoryItems(clinicId, {}), [clinicId], 'Inventory could not be loaded.');
  const list = items.data ?? [];
  const needing = list.filter((item) => stockStatus(item) !== 'good');
  const value = list.reduce((sum, item) => sum + item.quantity_usable * Number(item.unit_cost ?? 0), 0);
  return (
    <>
      <LoadState loading={items.loading} error={items.error} onRetry={items.reload} />
      {items.data && (
        <>
          <SummaryCards
            cards={[
              { label: 'Total Items', value: formatCount(list.length), note: 'Active items' },
              { label: 'Low Stock', value: formatCount(list.filter((i) => stockStatus(i) === 'low').length), note: 'Below minimum level' },
              { label: 'Critical', value: formatCount(list.filter((i) => stockStatus(i) === 'critical').length), note: 'Needs immediate restock' },
              { label: 'Total Value', value: formatPeso(value), note: 'Usable stock × unit cost' },
            ]}
          />
          <Card title="Items to Restock">
            {needing.length === 0 && <EmptyState text="Every item is above its minimum stock." />}
            {needing.map((item) => (
              <View key={item.id} style={ui.listItem}>
                <View style={ui.between}>
                  <Text style={[ui.title, ui.flex]}>{item.name}</Text>
                  <Badge tone={stockStatus(item) === 'critical' ? 'danger' : 'warning'} label={stockStatus(item) === 'critical' ? 'Critical' : 'Low'} />
                </View>
                <Text style={ui.muted}>
                  {item.quantity_usable} {item.unit} · minimum {item.minimum_stock}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Comma-separated text of the open tab (the web page saves the same rows as a file). */
export const reportCsv = (tab: Tab, data: ReportAnalytics, items: InventoryItem[] = []) => {
  const rows: unknown[][] =
    tab === 'revenue'
      ? [['Month', 'Estimated revenue (PHP)', 'Completed visits'], ...data.months.map((m) => [m.month, m.revenue, m.completed_visits])]
      : tab === 'treatments'
        ? [['Service', 'Booked', 'Estimated revenue (PHP)'], ...data.treatments.map((t) => [t.service, t.total, t.revenue])]
        : tab === 'patients'
          ? [['Month', 'New patients'], ...data.months.map((m) => [m.month, m.new_patients])]
          : tab === 'inventory'
            ? [['Item', 'Qty', 'Unit', 'Min. stock', 'Status'], ...items.map((i) => [i.name, i.quantity_usable, i.unit, i.minimum_stock, stockStatus(i)])]
            : [['Month', 'Total', 'Confirmed', 'Cancelled'], ...data.months.map((m) => [m.month, m.total, m.confirmed, m.cancelled])];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
};

const ClinicReportsScreen = () => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const [tab, setTab] = useState<Tab>('appointments');
  const [shareError, setShareError] = useState<string | null>(null);
  const analytics = useLoader(() => fetchReportAnalytics(clinicId), [clinicId], 'The report could not be loaded.');
  const data = analytics.data;

  const share = async () => {
    if (!data) return;
    setShareError(null);
    try {
      const items = tab === 'inventory' ? await fetchInventoryItems(clinicId, {}) : [];
      await Share.share({ title: `Clinic report: ${tab}`, message: reportCsv(tab, data, items) });
    } catch (err) {
      setShareError(serverMessage(err, 'The report could not be shared.'));
    }
  };

  return (
    <ClinicScreen title="Reports & Analytics" active="ClinicReports">
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={analytics.refreshing} onRefresh={analytics.refresh} colors={[palette.primary]} />}>
        <Chips options={TABS} value={tab} onChange={setTab} />
        {data && <Button small variant="outline" icon="share-outline" label="Share as CSV" onPress={share} />}
        <FormError message={shareError} />
        <LoadState loading={analytics.loading} error={data ? null : analytics.error} onRetry={analytics.reload} />
        {data && tab === 'appointments' && <AppointmentsTab data={data} clinicId={clinicId} />}
        {data && tab === 'revenue' && <RevenueTab data={data} />}
        {data && tab === 'treatments' && <TreatmentsTab data={data} />}
        {data && tab === 'patients' && <PatientsTab data={data} />}
        {data && tab === 'inventory' && <InventoryTab clinicId={clinicId} />}
      </ScrollView>
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { width: '47%', flexGrow: 1, padding: spacing.md, borderRadius: radius.xxl, alignItems: 'center', backgroundColor: palette.surfaceContainerLowest, borderWidth: 1, borderColor: 'rgba(194,198,212,0.3)' },
  cardValue: { ...type.titleLg, fontWeight: '700', color: palette.primary },
  cardLabel: { fontSize: 13, fontWeight: '600', color: palette.onSurface, textAlign: 'center' },
  cardNote: { fontSize: 11, color: palette.onSurfaceVariant, textAlign: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, minHeight: 28 },
  barLabel: { width: 76, fontSize: 12, color: palette.onSurfaceVariant },
  track: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: palette.surfaceContainerHigh },
  trackRow: { flexDirection: 'row' },
  segment: { height: '100%' },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  fill: { height: '100%', borderRadius: 5 },
  barValue: { minWidth: 44, fontSize: 12, fontWeight: '600', color: palette.onSurface, textAlign: 'right' },
});

export default ClinicReportsScreen;
