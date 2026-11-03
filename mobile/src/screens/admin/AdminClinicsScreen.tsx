// Verification (web: pages/admin/AdminClinicsPage.jsx): registrations with
// their document status and review priority, and the verified clinics
// directory. Platform oversight only: no access to patients or records.
// Suspending, reactivating and exporting need the password (423).
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { MetricGrid } from '../../components/admin/AdminMetrics';
import { actionError, PasswordPrompt, useSensitiveAction } from '../../components/admin/AdminSecurity';
import { Badge, Button, Card, Chips, EmptyState, Field, FormError, LoadState, Pager, SearchBox, Sheet, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import {
  AdminClinic,
  ClinicApplication,
  DOCUMENT_LABELS,
  DOCUMENT_STATUS,
  exportApplicationsCsv,
  fetchAdminClinics,
  fetchApplications,
  fetchApplicationSummary,
  MOBILE_EXPORT_ROWS,
  PRIORITY_LABELS,
  reactivateClinic,
  suspendClinic,
  verificationMetrics,
} from '../../services/admin';
import { formatDateTime } from '../../services/clinicPortal';
import { palette } from '../../theme/tokens';

const Separator = () => <View style={ui.stackItem} />;

type ListName = 'all' | 'attention' | 'clinics';

const REGISTRATION_STATUSES = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'under_review', label: 'Under review' },
  { id: 'approved', label: 'Verified' },
  { id: 'rejected', label: 'More info requested' },
];

const CLINIC_STATUSES = [
  { id: '', label: 'All' },
  { id: 'approved', label: 'Verified' },
  { id: 'pending', label: 'Pending' },
  { id: 'suspended', label: 'Suspended' },
];


function useDebounced(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function SuspendSheet({ clinic, onClose, onDone }: { clinic: AdminClinic; onClose: () => void; onDone: () => void }) {
  const sensitive = useSensitiveAction();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await sensitive.run(() => suspendClinic(clinic.id, reason.trim()));
      onDone();
    } catch (err) {
      setError(actionError(err, 'The clinic could not be suspended.'));
      setBusy(false);
    }
  };

  return (
    <Sheet title={`Suspend ${clinic.name}?`} onClose={busy ? () => undefined : onClose}>
      <Text style={ui.muted}>Suspending hides the clinic from the directory and stops new bookings. Its staff keep their accounts.</Text>
      <Field label="Reason (recorded in the audit log)" required multiline maxLength={1000} value={reason} onChangeText={setReason} />
      <FormError message={error} />
      <PasswordPrompt sensitive={sensitive} inline />
      {!sensitive.asking && <Button label="Suspend clinic" variant="danger" style={ui.spacedTop} busy={busy} disabled={!reason.trim()} onPress={submit} />}
    </Sheet>
  );
}

function RegistrationItem({ item: a, onOpen }: { item: ClinicApplication; onOpen: () => void }) {
  const status = DOCUMENT_STATUS[a.document_status ?? 'pending'] ?? DOCUMENT_STATUS.pending;
  const needsWork = a.document_status === 'missing_info' || a.priority === 'high';
  return (
    <TouchableOpacity style={ui.listItem} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${needsWork ? 'Resolve issues for' : 'View documents for'} ${a.clinic_name}`}>
      <View style={ui.between}>
        <Text style={[ui.title, ui.flex]} numberOfLines={1}>{a.clinic_name}</Text>
        <Badge tone={status.tone} label={status.label} />
      </View>
      <Text style={ui.muted} numberOfLines={1}>
        {a.reference ?? `#${a.id}`} · {[a.city, a.province].filter(Boolean).join(', ') || '—'}
      </Text>
      <Text style={ui.small}>{a.submitted_at ? `Submitted ${formatDateTime(a.submitted_at)}` : 'Not submitted'}</Text>
      {a.priority ? <Text style={[ui.small, a.priority === 'high' && styles.danger]}>{PRIORITY_LABELS[a.priority]}</Text> : null}
      <Text style={styles.link}>{needsWork ? 'Resolve issues' : 'View documents'}</Text>
    </TouchableOpacity>
  );
}

function ClinicItem({ item: c, onSuspend, onReactivate }: { item: AdminClinic; onSuspend: () => void; onReactivate: () => void }) {
  return (
    <View style={ui.listItem}>
      <View style={ui.between}>
        <Text style={[ui.title, ui.flex]} numberOfLines={1}>{c.name}</Text>
        <Badge status={c.status} label={c.status === 'approved' ? 'Verified' : c.status === 'suspended' ? 'Suspended' : 'Pending'} />
      </View>
      <Text style={ui.muted}>
        CLIN-{String(c.id).padStart(5, '0')} · {c.city ?? '—'} · {c.is_published && c.status === 'approved' ? 'Listed' : 'Hidden'}
      </Text>
      <Text style={ui.small}>
        {c.members_count} staff · {c.branches_count} branches
      </Text>
      {c.suspension_reason ? <Text style={ui.small}>Suspended: {c.suspension_reason}</Text> : null}
      {c.status === 'suspended' ? (
        <Button small variant="outline" label="Reactivate" onPress={onReactivate} />
      ) : c.status === 'approved' ? (
        <Button small variant="danger" label="Suspend" onPress={onSuspend} />
      ) : null}
    </View>
  );
}

const AdminClinicsScreen = ({ route }: { route?: { params?: { search?: string; view?: ListName } } }) => {
  const navigation = useNavigation<any>();
  const sensitive = useSensitiveAction();
  const [view, setView] = useState<ListName>(route?.params?.view ?? (route?.params?.search ? 'clinics' : 'all'));
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState(route?.params?.search ?? '');
  const [page, setPage] = useState(1);
  const [suspending, setSuspending] = useState<AdminClinic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const term = useDebounced(search.trim());
  const isClinics = view === 'clinics';
  const params = { status: status || undefined, search: term || undefined, view: view === 'attention' ? 'attention' : undefined };

  const summary = useLoader(fetchApplicationSummary, [], 'Figures could not be loaded.');
  // The view travels with the data, so a list is never drawn with the other list's rows.
  const list = useLoader(
    async () =>
      isClinics
        ? { view, page: await fetchAdminClinics({ status: params.status, search: params.search, page }) }
        : { view, page: await fetchApplications({ ...params, page }) },
    [view, status, term, page],
    'The list could not be loaded.',
  );
  useRefreshOnFocus(() => {
    summary.sync();
    list.sync();
  });

  const changeView = (next: ListName) => {
    setView(next);
    setStatus('');
    setPage(1);
  };

  const reactivate = (clinic: AdminClinic) =>
    Alert.alert(`Reactivate ${clinic.name}?`, 'The clinic can take bookings again and, if its owner has published it, appears in the directory.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reactivate',
        onPress: async () => {
          setError(null);
          try {
            await sensitive.run(() => reactivateClinic(clinic.id));
            list.sync();
          } catch (err) {
            setError(actionError(err, 'The clinic could not be reactivated.'));
          }
        },
      },
    ]);

  const share = async () => {
    setExporting(true);
    setError(null);
    try {
      const csv = await sensitive.run(() => exportApplicationsCsv(params));
      await Share.share({ title: 'Clinic registrations (CSV)', message: csv });
    } catch (err) {
      setError(actionError(err, 'The export could not be created.'));
    } finally {
      setExporting(false);
    }
  };

  const items = list.data?.view === view ? list.data.page.items : [];
  const meta = list.data?.view === view ? list.data.page.meta : null;
  const s = summary.data;

  return (
    <AdminScreen title="Verification" active="AdminClinics">
      <FlatList<ClinicApplication | AdminClinic>
        data={items}
        keyExtractor={(row) => `${view}-${row.id}`}
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
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
            <Text style={ui.muted}>Review and validate regulatory documents of newly registered clinics before granting full platform access.</Text>
            <MetricGrid metrics={verificationMetrics(s)} />
            {!isClinics && (
              <Button
                small
                variant="outline"
                label={exporting ? 'Preparing CSV…' : 'Share CSV'}
                busy={exporting}
                onPress={share}
              />
            )}
            {!isClinics && <Text style={ui.small}>Shares up to {MOBILE_EXPORT_ROWS.toLocaleString()} registrations matching the filters. Asks for your password.</Text>}
            <Chips<ListName>
              options={[
                { id: 'all', label: 'All registrations' },
                { id: 'attention', label: s ? `Needs attention (${s.needs_attention})` : 'Needs attention' },
                { id: 'clinics', label: 'Verified clinics' },
              ]}
              value={view}
              onChange={changeView}
            />
            <SearchBox value={search} onChangeText={(t) => { setSearch(t); setPage(1); }} placeholder={isClinics ? 'Search clinic name' : 'Search clinic name or city'} />
            <Chips options={isClinics ? CLINIC_STATUSES : REGISTRATION_STATUSES} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
            <FormError message={error} />
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={
          meta ? <EmptyState icon={isClinics ? 'business-outline' : 'document-text-outline'} text={isClinics ? 'No clinics match.' : 'No registrations match.'} /> : undefined
        }
        ListFooterComponent={
          <View style={ui.stack}>
            {meta ? <Pager page={page} lastPage={meta.last_page} onChange={setPage} /> : null}
            <Card title="Verification checklist">
              <Text style={ui.muted}>Approve only when every required document is present, readable, current and issued to the clinic and representative named in the registration.</Text>
              {(s?.required_documents ?? []).map((t) => (
                <View key={t} style={styles.docRow}>
                  <Icon name="checkmark-circle" size={16} color={palette.secondary} />
                  <Text style={ui.small}>{DOCUMENT_LABELS[t] ?? t}</Text>
                </View>
              ))}
              {s?.oldest_open_id ? (
                <Button small label="Review oldest registration" onPress={() => navigation.navigate('AdminApplicationDetail', { applicationId: s.oldest_open_id })} />
              ) : null}
            </Card>
          </View>
        }
        ItemSeparatorComponent={Separator}
        renderItem={({ item }) =>
          isClinics ? (
            <ClinicItem item={item as AdminClinic} onSuspend={() => setSuspending(item as AdminClinic)} onReactivate={() => reactivate(item as AdminClinic)} />
          ) : (
            <RegistrationItem item={item as ClinicApplication} onOpen={() => navigation.navigate('AdminApplicationDetail', { applicationId: item.id })} />
          )
        }
      />
      {suspending && (
        <SuspendSheet
          clinic={suspending}
          onClose={() => setSuspending(null)}
          onDone={() => {
            setSuspending(null);
            list.sync();
          }}
        />
      )}
      <PasswordPrompt sensitive={sensitive} />
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  danger: { color: palette.error, fontWeight: '600' },
  link: { color: palette.primary, fontWeight: '600', fontSize: 13 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

export default AdminClinicsScreen;
