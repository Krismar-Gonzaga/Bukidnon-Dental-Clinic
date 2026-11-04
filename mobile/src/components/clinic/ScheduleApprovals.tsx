// Dentists' proposed hours waiting for a decision (web: components/clinic/ScheduleApprovals).
// Shows nothing when none are waiting.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NoteBox, StatRow } from './ClinicAdminKit';
import { Button, Card, Field, FormError, Sheet, ui, useLoader, useRefreshOnFocus } from './ClinicUi';
import { formatClockTime } from '../../services/booking';
import { DAYS, formatDateTime, serverMessage, WEEK_ORDER } from '../../services/clinicPortal';
import { approveScheduleChange, fetchScheduleChanges, rejectScheduleChange, ScheduleChange } from '../../services/dentistPortal';
import { palette, radius, spacing } from '../../theme/tokens';

const dayNames = (days: number[]) => WEEK_ORDER.filter((day) => days.includes(day)).map((day) => DAYS[day].slice(0, 3)).join(', ') || 'No working days';
const hours = (start?: string | null, end?: string | null) => (start && end ? `${formatClockTime(start)} – ${formatClockTime(end)}` : 'No hours set');

export default function ScheduleApprovals({ clinicId, dentistId, onDecided }: { clinicId: number; dentistId?: number; onDecided?: () => void }) {
  const list = useLoader(() => fetchScheduleChanges(clinicId, dentistId), [clinicId, dentistId], 'Schedule changes could not be loaded.');
  useRefreshOnFocus(list.sync);
  const [sheet, setSheet] = useState<{ change: ScheduleChange; action: 'approve' | 'decline' } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changes = list.data ?? [];

  const close = () => {
    setSheet(null);
    setReason('');
    setError(null);
  };

  const decide = async () => {
    if (!sheet) return;
    setBusy(true);
    setError(null);
    try {
      if (sheet.action === 'approve') await approveScheduleChange(clinicId, sheet.change.id);
      else await rejectScheduleChange(clinicId, sheet.change.id, reason.trim());
      close();
      list.sync();
      onDecided?.();
    } catch (err) {
      setError(serverMessage(err, 'That decision could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  if (changes.length === 0) return list.error ? <FormError message={list.error} /> : null;

  return (
    <Card title="Schedule Changes to Approve" subtitle="Nothing changes for patients until you approve.">
      {changes.map((change) => (
        <View key={change.id} style={styles.change}>
          <Text style={ui.title}>{change.dentist?.name}</Text>
          <Text style={ui.small}>{change.branch?.name} · Sent {formatDateTime(change.created_at)}</Text>
          <StatRow label="Now" value={`${dayNames(change.current?.days ?? [])} · ${hours(change.current?.starts_at, change.current?.ends_at)}`} />
          <StatRow label="Requested" value={`${dayNames(change.days)} · ${hours(change.starts_at, change.ends_at)}`} />
          {change.note ? <Text style={styles.note}>“{change.note}”</Text> : null}
          {(change.outside_hours ?? 0) > 0 && (
            <NoteBox>{change.outside_hours === 1 ? '1 booked visit falls' : `${change.outside_hours} booked visits fall`} outside these hours. Approving does not move them.</NoteBox>
          )}
          <View style={ui.rowWrap}>
            <Button small label="Approve" onPress={() => setSheet({ change, action: 'approve' })} />
            <Button small variant="outline" label="Decline" onPress={() => setSheet({ change, action: 'decline' })} />
          </View>
        </View>
      ))}

      {sheet?.action === 'approve' && (
        <Sheet title="Approve schedule change?" onClose={close}>
          <Text style={ui.muted}>{sheet.change.dentist?.name}&apos;s new hours take effect right away, and patients can book within them.</Text>
          <FormError message={error} />
          <Button label="Approve" style={ui.spacedTop} busy={busy} onPress={decide} />
        </Sheet>
      )}
      {sheet?.action === 'decline' && (
        <Sheet title="Decline schedule change" onClose={close}>
          <Text style={ui.muted}>{sheet.change.dentist?.name} will be told the reason. Their current hours stay the same.</Text>
          <Field label="Reason" required multiline maxLength={500} value={reason} onChangeText={setReason} />
          <FormError message={error} />
          <Button label="Decline" variant="danger" style={ui.spacedTop} busy={busy} disabled={!reason.trim()} onPress={decide} />
        </Sheet>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  change: { gap: spacing.xs, padding: spacing.sm, marginTop: spacing.sm, borderRadius: radius.lg, backgroundColor: '#fffbe8', borderWidth: 1, borderColor: '#f3e3a1' },
  note: { fontSize: 13, color: palette.onSurfaceVariant },
});
