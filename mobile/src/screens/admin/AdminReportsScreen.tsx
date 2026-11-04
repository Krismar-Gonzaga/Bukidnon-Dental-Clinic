// Reports & Analytics (web: pages/admin/AdminReportsPage.jsx). Platform aggregates only.
import React, { useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { MiniBars, ShareBar } from '../../components/admin/AdminWidgets';
import { Button, Card, Chips, FormError, LoadState, ui, useLoader } from '../../components/clinic/ClinicUi';
import { exportReportCsv, fetchReports, ReportRow, shiftMonth } from '../../services/admin';
import { serverMessage } from '../../services/clinicPortal';
import { palette, spacing } from '../../theme/tokens';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'clinics', label: 'Clinics' },
  { id: 'users', label: 'Users' },
  { id: 'subscriptions', label: 'Subscriptions' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const TITLES: Record<Exclude<TabId, 'overview'>, string> = { clinics: 'Clinics Report', users: 'Users Report', subscriptions: 'Subscriptions Report' };

const signed = (change: number) => (change > 0 ? `+${change}` : String(change));

function ReportTable({ rows, current, previous }: { rows: ReportRow[]; current: string; previous: string }) {
  return (
    <>
      <View style={styles.row}>
        <Text style={[styles.head, styles.metric]}>Metric</Text>
        <Text style={styles.head}>{current}</Text>
        <Text style={styles.head}>{previous}</Text>
        <Text style={styles.head}>Change</Text>
      </View>
      {rows.map((row) => (
        <View key={row.metric} style={styles.row} accessible accessibilityLabel={`${row.metric}: ${row.current}, ${previous} ${row.previous}, change ${signed(row.change)}`}>
          <Text style={styles.metric}>{row.metric}</Text>
          <Text style={[styles.cell, styles.current]}>{row.current}</Text>
          <Text style={styles.cell}>{row.previous}</Text>
          <Text style={[styles.cell, row.change > 0 && styles.up, row.change < 0 && styles.down]}>{signed(row.change)}</Text>
        </View>
      ))}
    </>
  );
}

const AdminReportsScreen = () => {
  const [tab, setTab] = useState<TabId>('overview');
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reports = useLoader(() => fetchReports(month), [month], 'Reports could not be loaded.');
  const data = reports.data;

  const share = async () => {
    setExporting(true);
    setError(null);
    try {
      const csv = await exportReportCsv({ month, section: tab === 'overview' ? undefined : tab });
      await Share.share({ title: 'Platform report', message: csv });
    } catch (err) {
      setError(serverMessage(err, 'The report could not be exported.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminScreen title="Reports & Analytics" active="AdminReports">
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={reports.refreshing} onRefresh={reports.refresh} />}>
        <Chips options={[...TABS]} value={tab} onChange={setTab} />
        <Button small variant="outline" icon="share-outline" label="Export Report" busy={exporting} onPress={share} />
        <FormError message={error} />
        {!data ? (
          <LoadState loading={reports.loading} error={reports.error} onRetry={reports.reload} />
        ) : tab === 'overview' ? (
          <>
            <Card title="Clinic Growth" subtitle="Verified clinics at the end of each month">
              <MiniBars label="Verified clinics per month" rows={data.overview.clinic_growth.map((point) => ({ key: point.month, label: point.label, value: point.total }))} />
            </Card>
            <Card title="Subscription Plans" subtitle="Clinics on each plan">
              <ShareBar label="Clinics per plan" rows={data.overview.plans} />
            </Card>
          </>
        ) : (
          <Card title={TITLES[tab]} subtitle={`${data.month_label} compared with ${data.previous_label}`}>
            <View style={styles.monthPicker}>
              <Button small variant="outline" icon="chevron-back" label="Earlier" onPress={() => setMonth(shiftMonth(data.month, -1))} />
              <Text style={styles.monthLabel}>{data.month_label}</Text>
              <Button small variant="outline" icon="chevron-forward" label="Later" onPress={() => setMonth(shiftMonth(data.month, 1))} />
            </View>
            <ReportTable rows={data[tab]} current={month ? data.month_label.split(' ')[0].slice(0, 3) : 'This'} previous={month ? data.previous_label.split(' ')[0].slice(0, 3) : 'Last'} />
          </Card>
        )}
      </ScrollView>
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  monthPicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm },
  monthLabel: { flex: 1, fontWeight: '600', textAlign: 'center', color: palette.onSurface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.surfaceContainerHigh },
  head: { width: 52, fontSize: 11, fontWeight: '600', color: palette.onSurfaceVariant, textTransform: 'uppercase' },
  metric: { flex: 1, width: undefined, fontSize: 14, color: palette.onSurface },
  cell: { width: 52, fontSize: 14, color: palette.onSurfaceVariant },
  current: { fontWeight: '700', color: palette.primary },
  up: { fontWeight: '600', color: palette.secondary },
  down: { fontWeight: '600', color: palette.error },
});

export default AdminReportsScreen;
