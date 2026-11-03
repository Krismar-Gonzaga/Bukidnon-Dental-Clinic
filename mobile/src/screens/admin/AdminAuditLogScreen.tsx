// System audit log (web: pages/admin/AdminAuditLogPage.jsx). Entries cannot
// be edited or deleted, and are sealed into a tamper-evident hash chain
// (backend App\Services\AuditChain). Sharing a CSV needs the password (423).
import React, { useState } from 'react';
import { FlatList, RefreshControl, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { MetricGrid } from '../../components/admin/AdminMetrics';
import { actionError, PasswordPrompt, useSensitiveAction } from '../../components/admin/AdminSecurity';
import { Badge, Button, Card, Chips, EmptyState, FormError, InfoRow, LoadState, Pager, Sheet, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import {
  AUDIT_CATEGORIES,
  AUDIT_OUTCOMES,
  AUDIT_RANGES,
  AuditEntry,
  auditMetrics,
  checkAuditIntegrity,
  exportAuditCsv,
  fetchAuditLogs,
  fetchAuditSummary,
  IntegrityReport,
  MOBILE_EXPORT_ROWS,
  USER_ROLE_LABELS,
} from '../../services/admin';
import { formatDateTime } from '../../services/clinicPortal';
import { palette } from '../../theme/tokens';

const Separator = () => <View style={ui.stackItem} />;

const ROLE_FILTERS = [
  { id: '', label: 'All roles' },
  ...Object.entries(USER_ROLE_LABELS).map(([id, label]) => ({ id, label })),
  { id: 'none', label: 'Not signed in' },
];

const who = (l: AuditEntry) => l.user_name ?? (l.user_id ? `User #${l.user_id}` : 'Not signed in');

function EventSheet({ log, onClose }: { log: AuditEntry; onClose: () => void }) {
  return (
    <Sheet title="Event details" onClose={onClose}>
      <InfoRow label="Event" value={`#${log.id} · ${log.label}`} />
      <InfoRow label="Code" value={log.action} />
      <InfoRow label="When" value={formatDateTime(log.created_at)} />
      <InfoRow label="Outcome" value={AUDIT_OUTCOMES[log.outcome]?.label ?? log.outcome} />
      <InfoRow label="User" value={`${who(log)}${log.user_role ? ` (${USER_ROLE_LABELS[log.user_role] ?? log.user_role})` : ''}`} />
      <InfoRow label="Subject" value={log.subject_label ?? '—'} />
      <InfoRow label="Details" value={log.detail ?? '—'} />
      <InfoRow label="Clinic ID" value={log.clinic_id ?? '—'} />
      <InfoRow label="IP address" value={log.ip_address ?? '—'} />
      <InfoRow label="Device" value={log.user_agent || '—'} />
      <InfoRow label="Integrity" value={log.sealed ? 'Sealed in the hash chain' : 'Waiting to be sealed (within 5 minutes)'} />
    </Sheet>
  );
}

function IntegrityCard({ report }: { report: IntegrityReport }) {
  const ok = report.status === 'verified';
  return (
    <Card title={ok ? 'No alterations detected' : 'Integrity problems found'} subtitle={`Checked ${formatDateTime(report.checked_at)}`}>
      <Text style={ui.muted}>
        {report.checked.toLocaleString()} sealed entries re-checked · {report.pending.toLocaleString()} newer entries waiting to be sealed.
      </Text>
      {report.problems.map((p) => (
        <Text key={`${p.type}-${p.id}`} style={[ui.small, styles.danger]}>
          Event #{p.id}: {p.message}
        </Text>
      ))}
    </Card>
  );
}

const AdminAuditLogScreen = ({ route }: { route?: { params?: { action?: string } } }) => {
  const sensitive = useSensitiveAction();
  const [range, setRange] = useState('24h');
  const [category, setCategory] = useState('');
  const [role, setRole] = useState('');
  const [action, setAction] = useState(route?.params?.action ?? '');
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState<AuditEntry | null>(null);
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const params = { range: range === 'all' ? undefined : range, category: category || undefined, role: role || undefined, action: action || undefined };

  const list = useLoader(() => fetchAuditLogs({ ...params, page }), [range, category, role, action, page], 'The audit log could not be loaded.');
  const summary = useLoader(() => fetchAuditSummary(params), [range, category, role, action], 'Figures could not be loaded.');
  useRefreshOnFocus(() => {
    list.sync();
    summary.sync();
  });
  const pick = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  const runCheck = async () => {
    setChecking(true);
    setError(null);
    try {
      setReport(await checkAuditIntegrity());
      summary.sync();
      list.sync();
    } catch (err) {
      setError(actionError(err, 'The integrity check could not run.'));
    } finally {
      setChecking(false);
    }
  };

  const share = async () => {
    setExporting(true);
    setError(null);
    try {
      const csv = await sensitive.run(() => exportAuditCsv(params));
      await Share.share({ title: 'Audit log (CSV)', message: csv });
    } catch (err) {
      setError(actionError(err, 'The export could not be created.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminScreen title="Audit Logs" active="AdminAuditLog">
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={ui.content}
        refreshControl={
          <RefreshControl
            refreshing={list.refreshing}
            onRefresh={() => {
              summary.sync();
              list.refresh();
            }}
          />
        }
        ListHeaderComponent={
          <View style={ui.stack}>
            <Text style={ui.muted}>Chronological record of administrative actions and security events. Entries cannot be edited or deleted.</Text>
            <MetricGrid metrics={auditMetrics(summary.data, range)} />
            <View style={ui.rowWrap}>
              <Button small variant="outline" label={exporting ? 'Preparing CSV…' : 'Share CSV'} busy={exporting} onPress={share} />
              <Button small label={checking ? 'Checking…' : 'Run integrity check'} busy={checking} onPress={runCheck} />
            </View>
            <Text style={ui.small}>Share CSV sends up to {MOBILE_EXPORT_ROWS.toLocaleString()} newest entries matching the filters and asks for your password.</Text>
            {report ? <IntegrityCard report={report} /> : null}
            <FormError message={error} />
            <Chips options={AUDIT_RANGES} value={range} onChange={pick(setRange)} />
            <Chips options={AUDIT_CATEGORIES} value={category} onChange={pick(setCategory)} />
            <Chips options={ROLE_FILTERS} value={role} onChange={pick(setRole)} />
            {action ? (
              <Button small variant="tonal" icon="close" label={`Action: ${action}`} onPress={() => pick(setAction)('')} />
            ) : null}
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.data ? <EmptyState icon="document-text-outline" text="No events match these filters." /> : undefined}
        ListFooterComponent={
          <View style={ui.stack}>
            {list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : null}
            <Card title="Tamper-evident audit integrity">
              <Text style={ui.muted}>
                The application and the database refuse to edit or delete entries. New entries are sealed into a hash chain every five minutes and before
                each check: each carries a keyed SHA-256 hash of its contents and of the entry before it, so a changed or removed entry is detected.
              </Text>
            </Card>
          </View>
        }
        ItemSeparatorComponent={Separator}
        renderItem={({ item: l }) => {
          const outcome = AUDIT_OUTCOMES[l.outcome] ?? AUDIT_OUTCOMES.success;
          return (
            <TouchableOpacity style={ui.listItem} onPress={() => setDetails(l)} accessibilityRole="button" accessibilityLabel={`${l.label}, ${outcome.label}. Show details`}>
              <View style={ui.between}>
                <Text style={[ui.title, ui.flex]} numberOfLines={2}>{l.label}</Text>
                <Badge tone={outcome.tone} label={outcome.label} />
              </View>
              <Text style={ui.small}>
                {formatDateTime(l.created_at)} · {who(l)}
                {l.user_role ? ` (${USER_ROLE_LABELS[l.user_role] ?? l.user_role})` : ''}
              </Text>
              {l.subject_label || l.detail ? (
                <Text style={[ui.muted, l.outcome !== 'success' && styles.danger]} numberOfLines={2}>
                  {[l.subject_label, l.detail].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {l.ip_address ? <Text style={[ui.small, styles.mono]}>{l.ip_address}</Text> : null}
            </TouchableOpacity>
          );
        }}
      />
      {details && <EventSheet log={details} onClose={() => setDetails(null)} />}
      <PasswordPrompt sensitive={sensitive} />
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  danger: { color: palette.error },
  mono: { fontFamily: 'monospace' },
});

export default AdminAuditLogScreen;
