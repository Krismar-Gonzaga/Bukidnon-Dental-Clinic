// Audit Logs (web: pages/admin/AdminAuditLogPage.jsx). Entries cannot be edited or deleted, and
// are sealed into a tamper-evident hash chain. Sharing a CSV needs the password (423).
import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { actionError, PasswordPrompt, useSensitiveAction } from '../../components/admin/AdminSecurity';
import { Badge, Button, Card, Chips, EmptyState, FormError, InfoRow, LoadState, Pager, SearchBox, Sheet, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { AUDIT_CATEGORIES, AUDIT_OUTCOMES, AuditEntry, checkAuditIntegrity, exportAuditCsv, fetchAuditLogs, IntegrityReport, MOBILE_EXPORT_ROWS, USER_ROLE_LABELS } from '../../services/admin';
import { formatDateTime } from '../../services/clinicPortal';
import { palette } from '../../theme/tokens';

const Separator = () => <View style={ui.stackItem} />;

const who = (l: AuditEntry) => l.user_name ?? (l.user_id ? `User #${l.user_id}` : 'Not signed in');
const roleOf = (l: AuditEntry) => (l.user_role ? USER_ROLE_LABELS[l.user_role] ?? l.user_role : l.user_id ? 'Account' : 'Anonymous');

function useDebounced(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function LogSheet({ log, onClose }: { log: AuditEntry; onClose: () => void }) {
  return (
    <Sheet title="Log Details" onClose={onClose}>
      <InfoRow label="Date & Time" value={formatDateTime(log.created_at)} />
      <InfoRow label="User" value={who(log)} />
      <InfoRow label="Role" value={roleOf(log)} />
      <InfoRow label="Action" value={log.label} />
      <InfoRow label="Module" value={log.module ?? '—'} />
      <InfoRow label="Record" value={log.subject_label ?? '—'} />
      <InfoRow label="Status" value={AUDIT_OUTCOMES[log.outcome]?.label ?? log.outcome} />
      {log.detail ? <InfoRow label="Details" value={log.detail} /> : null}
      <InfoRow label="IP Address" value={log.ip_address ?? '—'} />
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
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [action] = useState(route?.params?.action ?? '');
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState<AuditEntry | null>(null);
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const term = useDebounced(search.trim());
  const params = { search: term || undefined, category: category || undefined, action: action || undefined };

  const list = useLoader(() => fetchAuditLogs({ ...params, page }), [term, category, action, page], 'The audit log could not be loaded.');
  useRefreshOnFocus(list.sync);

  const runCheck = async () => {
    setChecking(true);
    setError(null);
    try {
      setReport(await checkAuditIntegrity());
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
      await Share.share({ title: 'Audit log', message: csv });
    } catch (err) {
      setError(actionError(err, 'The audit log could not be exported.'));
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
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            {list.data ? <Text style={ui.muted}>{list.data.meta.total.toLocaleString()} log entries</Text> : null}
            <SearchBox value={search} onChangeText={(text) => { setSearch(text); setPage(1); }} placeholder="Search logs..." />
            <Chips options={AUDIT_CATEGORIES} value={category} onChange={(next) => { setCategory(next); setPage(1); }} />
            <View style={ui.rowWrap}>
              <Button small variant="outline" icon="share-outline" label="Export" busy={exporting} onPress={share} />
              <Button small variant="outline" icon="shield-checkmark-outline" label="Run Integrity Check" busy={checking} onPress={runCheck} />
            </View>
            <Text style={ui.small}>Exports share the newest {MOBILE_EXPORT_ROWS.toLocaleString()} entries.</Text>
            <FormError message={error} />
            {report && <IntegrityCard report={report} />}
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.data ? <EmptyState icon="document-text-outline" text="No log entries match these filters." /> : undefined}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        ItemSeparatorComponent={Separator}
        renderItem={({ item: log }) => {
          const outcome = AUDIT_OUTCOMES[log.outcome] ?? AUDIT_OUTCOMES.success;
          return (
            <TouchableOpacity style={ui.listItem} onPress={() => setDetails(log)} accessibilityRole="button" accessibilityLabel={`View log entry: ${log.label}`}>
              <View style={ui.between}>
                <Text style={[ui.title, ui.flex]} numberOfLines={2}>{log.label}</Text>
                <Badge tone={outcome.tone} label={outcome.label} />
              </View>
              <Text style={ui.muted} numberOfLines={1}>{[log.subject_label, log.module].filter(Boolean).join(' · ') || '—'}</Text>
              <Text style={ui.small}>
                {who(log)} ({roleOf(log)}) · {formatDateTime(log.created_at)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
      {details && <LogSheet log={details} onClose={() => setDetails(null)} />}
      <PasswordPrompt sensitive={sensitive} />
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  danger: { color: palette.error },
});

export default AdminAuditLogScreen;
