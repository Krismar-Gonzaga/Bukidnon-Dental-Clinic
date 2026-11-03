// Clinic verification detail (web: pages/admin/AdminApplicationDetailPage.jsx):
// documents through 5-minute signed links, internal notes, the clinic
// snapshot, review history, and the decision. Approving or returning an
// application asks for confirmation, then for the password (423).
import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { AdminScreen, useOpenAdmin } from '../../components/admin/AdminChrome';
import { actionError, PasswordPrompt, useSensitiveAction } from '../../components/admin/AdminSecurity';
import { Badge, Button, Card, Field, FormError, InfoRow, LoadState, Sheet, ui, useLoader } from '../../components/clinic/ClinicUi';
import {
  addApplicationNote,
  APPLICATION_STATUS_LABELS,
  approveApplication,
  ClinicApplication,
  documentUrl,
  DOCUMENT_LABELS,
  fetchApplication,
  HistoryEntry,
  returnApplication,
  startReview,
} from '../../services/admin';
import { formatDateTime, serverMessage } from '../../services/clinicPortal';
import { palette, radius, spacing, type } from '../../theme/tokens';

const HISTORY_LABELS: Record<string, string> = {
  'clinic_application.submitted': 'Submission received',
  'clinic_application.document_uploaded': 'Document uploaded',
  'clinic_application.review_started': 'Manual review started',
  'clinic_application.document_accessed': 'Document opened',
  'clinic_application.note_added': 'Internal note added',
  'clinic_application.approved': 'Clinic approved',
  'clinic_application.rejected': 'Returned to the applicant',
};
const TONES: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = { pending: 'warning', under_review: 'info', approved: 'success', rejected: 'neutral' };

const fileSize = (bytes?: number | null) => (!bytes ? '' : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function Documents({ app }: { app: ClinicApplication }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const open = async (id: number, download: boolean) => {
    setError(null);
    setBusy(`${id}-${download}`);
    try {
      await Linking.openURL(await documentUrl(app.id, id, download));
    } catch (err) {
      setError(serverMessage(err, 'The document could not be opened.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title="Verification Documents" subtitle={`${app.documents.length} uploaded · links last 5 minutes and every view is logged`}>
      {app.documents.map((d) => {
        const label = DOCUMENT_LABELS[d.document_type] ?? d.document_type;
        return (
          <View key={d.id} style={styles.doc}>
            <View style={ui.row}>
              <View style={styles.docIcon}>
                <Icon name="document-text" size={22} color={palette.primary} />
              </View>
              <View style={ui.flex}>
                <Text style={ui.title}>{label}</Text>
                <Text style={ui.small} numberOfLines={1}>
                  {d.original_name}
                  {d.size ? ` • ${fileSize(d.size)}` : ''}
                </Text>
              </View>
            </View>
            <View style={ui.rowWrap}>
              <Button small variant="tonal" label="View" busy={busy === `${d.id}-false`} onPress={() => open(d.id, false)} />
              <Button small variant="outline" label="Download" busy={busy === `${d.id}-true`} onPress={() => open(d.id, true)} />
            </View>
          </View>
        );
      })}
      {app.missing_documents.length > 0 && <FormError message={`Missing: ${app.missing_documents.map((d) => DOCUMENT_LABELS[d] ?? d).join(', ')}`} />}
      <FormError message={error} />
    </Card>
  );
}

function Notes({ app, onSaved }: { app: ClinicApplication; onSaved: (history: HistoryEntry[]) => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notes = (app.history ?? []).filter((h) => h.action === 'clinic_application.note_added').reverse();

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await addApplicationNote(app.id, note.trim()));
      setNote('');
    } catch (err) {
      setError(serverMessage(err, 'The note could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Internal Notes" subtitle="Only administrators see these. They are kept in the audit log and cannot be edited.">
      <Field label="New note" multiline maxLength={2000} placeholder="Leave a note about this clinic's verification…" value={note} onChangeText={setNote} />
      <FormError message={error} />
      <Button small label="Save Note" busy={busy} disabled={!note.trim()} onPress={save} />
      {notes.map((n) => (
        <View key={n.id} style={styles.note}>
          <Text style={ui.muted}>{n.note}</Text>
          <Text style={ui.small}>
            {n.actor ?? 'Administrator'} · {formatDateTime(n.at)}
          </Text>
        </View>
      ))}
    </Card>
  );
}

function DecisionSheet({ app, kind, onClose, onDone }: { app: ClinicApplication; kind: 'approve' | 'return'; onClose: () => void; onDone: () => void }) {
  const sensitive = useSensitiveAction();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approve = kind === 'approve';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await sensitive.run<unknown>(() => (approve ? approveApplication(app.id, notes.trim() || undefined) : returnApplication(app.id, notes.trim())));
      onDone();
    } catch (err) {
      setError(actionError(err, 'The decision could not be saved.'));
      setBusy(false);
    }
  };

  return (
    <Sheet title={approve ? `Approve ${app.clinic_name}?` : 'Request more information'} onClose={busy ? () => undefined : onClose}>
      <Text style={ui.muted}>
        {approve
          ? 'Approving creates the clinic and its main branch, gives the applicant clinic-admin access and notifies them. The clinic stays hidden until the owner publishes it.'
          : 'The application goes back to the applicant with your message so they can fix it and submit again.'}
      </Text>
      <Field
        label={approve ? 'Message to the applicant (optional)' : 'What the applicant needs to fix'}
        required={!approve}
        multiline
        maxLength={2000}
        hint="Sent to the applicant."
        value={notes}
        onChangeText={setNotes}
      />
      <FormError message={error} />
      <PasswordPrompt sensitive={sensitive} inline />
      {!sensitive.asking && (
        <Button
          label={approve ? 'Approve clinic' : 'Send request'}
          style={ui.spacedTop}
          busy={busy}
          disabled={!approve && !notes.trim()}
          onPress={submit}
        />
      )}
    </Sheet>
  );
}

const AdminApplicationDetailScreen = ({ route }: { route: { params: { applicationId: number } } }) => {
  const { applicationId } = route.params;
  const open = useOpenAdmin('AdminApplicationDetail');
  const app = useLoader(() => fetchApplication(applicationId), [applicationId], 'This application could not be loaded.');
  const [decision, setDecision] = useState<'approve' | 'return' | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = app.data;

  const begin = async () => {
    setStarting(true);
    setError(null);
    try {
      await startReview(applicationId);
      await app.sync();
    } catch (err) {
      setError(serverMessage(err, 'The review could not be started.'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <AdminScreen title="Clinic Verification" active="AdminApplicationDetail" back>
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={app.refreshing} onRefresh={app.refresh} />}>
        {!a ? (
          <LoadState loading={app.loading} error={app.error} onRetry={app.reload} />
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">{a.clinic_name}</Text>
              <View style={ui.rowWrap}>
                <Badge tone={TONES[a.status]} label={APPLICATION_STATUS_LABELS[a.status] ?? a.status} />
                <Text style={ui.small}>{a.submitted_at ? `Submitted ${formatDateTime(a.submitted_at)}` : 'Not submitted'}</Text>
              </View>
            </View>

            {a.status === 'approved' && (
              <View style={styles.approved} accessibilityRole="alert">
                <Icon name="checkmark-circle" size={28} color={palette.secondary} />
                <View style={ui.flex}>
                  <Text style={styles.approvedTitle}>Clinic approval confirmed</Text>
                  <Text style={ui.muted}>
                    {a.clinic_name} is a verified clinic{a.reviewed_at ? ` since ${formatDateTime(a.reviewed_at)}` : ''}. The owner was notified and has
                    clinic-admin access; the clinic stays hidden until they publish it.
                  </Text>
                  <View style={[ui.rowWrap, styles.spaced]}>
                    <Button small variant="outline" label="Back to queue" onPress={() => open('AdminApplications')} />
                    <Button small label="View in Verification" onPress={() => open('AdminClinics', { search: a.clinic_name })} />
                  </View>
                </View>
              </View>
            )}
            {a.status === 'rejected' && (
              <Text style={styles.returned}>
                Returned to the applicant{a.reviewed_at ? ` on ${formatDateTime(a.reviewed_at)}` : ''}. Waiting for them to correct and resubmit.
              </Text>
            )}

            {['pending', 'under_review'].includes(a.status) && (
              <View style={ui.rowWrap}>
                {a.status === 'pending' && <Button small variant="outline" label="Start Review" busy={starting} onPress={begin} />}
                <Button small variant="outline" label="Request More Info" onPress={() => setDecision('return')} />
                <Button small label="Approve Clinic" disabled={a.missing_documents.length > 0} onPress={() => setDecision('approve')} />
              </View>
            )}
            <FormError message={error} />

            <Documents app={a} />
            <Notes app={a} onSaved={(history) => app.setData({ ...a, history })} />

            <Card title="Clinic Snapshot">
              <InfoRow label="Location" value={[a.address, a.city, a.province].filter(Boolean).join(', ')} />
              <InfoRow label="Contact email" value={a.email} />
              <InfoRow label="Phone" value={a.contact_number} />
              <InfoRow label="Representative" value={[a.representative_name, a.representative_position].filter(Boolean).join(', ')} />
              <InfoRow label="Applicant account" value={a.applicant ? `${a.applicant.name} (${a.applicant.email})` : null} />
              {a.description ? <Text style={[ui.muted, styles.spaced]}>{a.description}</Text> : null}
            </Card>

            <Card title="Review History">
              {(a.history ?? []).length === 0 ? <Text style={ui.muted}>No recorded events yet.</Text> : null}
              {(a.history ?? [])
                .slice()
                .reverse()
                .map((h) => (
                  <View key={h.id} style={styles.historyRow}>
                    <View style={styles.historyDot} />
                    <View style={ui.flex}>
                      <Text style={ui.title}>{HISTORY_LABELS[h.action] ?? h.action}</Text>
                      <Text style={ui.small}>
                        {formatDateTime(h.at)}
                        {h.actor ? ` · ${h.actor}` : ''}
                      </Text>
                      {h.document_type ? <Text style={ui.small}>{DOCUMENT_LABELS[h.document_type] ?? h.document_type}</Text> : null}
                    </View>
                  </View>
                ))}
            </Card>
          </>
        )}
      </ScrollView>

      {decision && a && (
        <DecisionSheet
          app={a}
          kind={decision}
          onClose={() => setDecision(null)}
          onDone={() => {
            setDecision(null);
            app.sync();
          }}
        />
      )}
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  title: { ...type.headlineLgMobile, color: palette.onSurface },
  spaced: { marginTop: spacing.sm },
  approved: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(0,108,79,0.25)', backgroundColor: 'rgba(103,252,198,0.15)' },
  approvedTitle: { ...type.titleLg, color: palette.onSecondaryContainer, fontWeight: '600' },
  returned: { ...type.bodyMd, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerHigh, color: palette.onSurface },
  doc: { gap: spacing.sm, padding: spacing.sm, marginTop: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.outlineVariant },
  docIcon: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: 'rgba(0,86,179,0.1)', alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: spacing.sm, padding: spacing.sm, borderLeftWidth: 3, borderLeftColor: palette.primaryFixed, borderRadius: radius.sm, backgroundColor: palette.surfaceContainerLow, gap: 2 },
  historyRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: palette.primary },
});

export default AdminApplicationDetailScreen;
