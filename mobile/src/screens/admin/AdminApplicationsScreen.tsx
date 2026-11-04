// Clinic Verification (web: pages/admin/AdminApplicationsPage.jsx): every submitted
// registration, with its documents and any note. Drafts stay private to the applicant.
import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { Badge, Button, EmptyState, LoadState, Pager, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { CLINIC_STATUS, ClinicApplication, DOCUMENT_LABELS, fetchApplications } from '../../services/admin';
import { formatDateTime } from '../../services/clinicPortal';
import { DecisionKind, DecisionSheet } from './AdminApplicationDetailScreen';

const Separator = () => <View style={ui.stackItem} />;
const OPEN = ['pending', 'under_review'];

const noteOf = (a: ClinicApplication) => {
  if (a.status === 'rejected') return a.review_notes;
  if (a.status === 'approved') return 'All documents verified.';
  if (a.missing_documents.length > 0) return `${a.missing_documents.map((type) => DOCUMENT_LABELS[type] ?? type).join(', ')} missing.`;
  return null;
};

const AdminApplicationsScreen = () => {
  const navigation = useNavigation<any>();
  const [page, setPage] = useState(1);
  const [deciding, setDeciding] = useState<{ kind: DecisionKind; application: ClinicApplication } | null>(null);
  const list = useLoader(() => fetchApplications({ page }), [page], 'Verification requests could not be loaded.');
  useRefreshOnFocus(list.sync);

  return (
    <AdminScreen title="Clinic Verification" active="AdminApplications">
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            {list.data ? <Text style={ui.muted}>{list.data.meta.total} verification requests</Text> : null}
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.data ? <EmptyState icon="shield-outline" text="No verification requests yet." /> : undefined}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        ItemSeparatorComponent={Separator}
        renderItem={({ item: a }) => {
          const badge = a.documents_requested ? { label: 'More Documents Requested', tone: 'warning' as const } : CLINIC_STATUS[a.status] ?? CLINIC_STATUS.pending;
          const note = noteOf(a);
          return (
            <View style={ui.listItem}>
              <TouchableOpacity onPress={() => navigation.navigate('AdminApplicationDetail', { applicationId: a.id })} accessibilityRole="button" accessibilityLabel={`Review ${a.clinic_name}`}>
                <View style={ui.between}>
                  <Text style={[ui.title, ui.flex]} numberOfLines={1}>{a.clinic_name}</Text>
                  <Badge tone={badge.tone} label={badge.label} />
                </View>
                <Text style={ui.muted}>
                  {[
                    `Admin: ${a.representative_name || a.applicant?.name || '—'}`,
                    a.submitted_at && `Submitted: ${formatDateTime(a.submitted_at)}`,
                    `Docs: ${a.documents_submitted}/${a.documents_required}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {note ? <Text style={styles.note}>{note}</Text> : null}
              </TouchableOpacity>
              {OPEN.includes(a.status) && (
                <View style={ui.rowWrap}>
                  <Button small variant="tonal" label="Approve" disabled={a.missing_documents.length > 0} onPress={() => setDeciding({ kind: 'approve', application: a })} />
                  <Button small variant="danger" label="Reject" onPress={() => setDeciding({ kind: 'return', application: a })} />
                </View>
              )}
            </View>
          );
        }}
      />
      {deciding && (
        <DecisionSheet
          app={deciding.application}
          kind={deciding.kind}
          onClose={() => setDeciding(null)}
          onDone={() => {
            setDeciding(null);
            list.sync();
          }}
        />
      )}
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  note: { fontSize: 13, color: '#a86a00', marginTop: 2 },
});

export default AdminApplicationsScreen;
