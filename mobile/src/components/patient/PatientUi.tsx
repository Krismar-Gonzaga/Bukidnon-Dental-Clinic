// Pieces shared by the patient pages, with the website's look.
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Card, guestColors, OutlineButton, PrimaryButton } from '../guest/GuestUi';
import { formatClockTime, formatDateKey, Slot } from '../../services/booking';
import { Appointment, appointmentDate, appointmentGroup, appointmentTime, AppointmentGroup, canReschedule } from '../../services/patientPortal';
import { spacing, type } from '../../theme/tokens';

const BADGES: Record<AppointmentGroup, { label: string; color: string; background: string; border: string }> = {
  pending: { label: 'Pending', color: '#a16207', background: '#fdf8e8', border: '#f3e2a6' },
  upcoming: { label: 'Upcoming', color: '#1d4ed8', background: '#eaf0fb', border: '#bfd3fb' },
  completed: { label: 'Completed', color: '#13784a', background: '#ecfbf3', border: '#b6e6cb' },
  cancelled: { label: 'Cancelled', color: '#c81e1e', background: '#fdecec', border: '#f8c4c4' },
};

export const StatusBadge = ({ group }: { group: AppointmentGroup }) => {
  const badge = BADGES[group];
  return (
    <Text style={[styles.badge, { color: badge.color, backgroundColor: badge.background, borderColor: badge.border }]}>{badge.label}</Text>
  );
};

export const BackLink = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.back} onPress={onPress} accessibilityRole="link" hitSlop={8}>
    <Icon name="chevron-back" size={16} color={guestColors.text} />
    <Text style={styles.backText}>{label}</Text>
  </TouchableOpacity>
);

export const Notice = ({ tone = 'warning', title, children }: { tone?: 'warning' | 'danger'; title?: string; children: string }) => (
  <View style={[styles.notice, tone === 'danger' && styles.noticeDanger]}>
    <Icon name="alert-circle-outline" size={18} color={tone === 'danger' ? '#c81e1e' : '#a16207'} />
    <View style={styles.flex}>
      {title ? <Text style={[styles.noticeTitle, tone === 'danger' && styles.noticeTextDanger]}>{title}</Text> : null}
      <Text style={[styles.noticeText, tone === 'danger' && styles.noticeTextDanger]}>{children}</Text>
    </View>
  </View>
);

export const SuccessCard = ({ title, message, actionLabel, onAction }: { title: string; message: string; actionLabel: string; onAction: () => void }) => (
  <Card style={styles.success}>
    <Icon name="checkmark-circle-outline" size={64} color="#22a35a" />
    <Text style={styles.successTitle} accessibilityLiveRegion="polite">
      {title}
    </Text>
    <Text style={styles.successText}>{message}</Text>
    <PrimaryButton label={actionLabel} onPress={onAction} style={styles.successButton} />
  </Card>
);

export const ConfirmModal = ({
  visible,
  title,
  message,
  keepLabel,
  confirmLabel,
  busy,
  onKeep,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  keepLabel: string;
  confirmLabel: string;
  busy?: boolean;
  onKeep: () => void;
  onConfirm: () => void;
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
    <View style={styles.modalRoot}>
      <View style={styles.modalCard} accessibilityViewIsModal>
        <Icon name="alert-circle-outline" size={48} color="#ef3b3b" />
        <Text style={styles.successTitle}>{title}</Text>
        <Text style={styles.successText}>{message}</Text>
        <View style={styles.modalActions}>
          <OutlineButton label={keepLabel} onPress={onKeep} style={styles.flex} />
          <TouchableOpacity style={styles.danger} onPress={onConfirm} disabled={busy} accessibilityRole="button" accessibilityState={{ busy: Boolean(busy) }}>
            <Text style={styles.dangerText}>{busy ? 'Please wait…' : confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

/** Service, dentist · clinic, date and the actions that fit the appointment's status. */
export const AppointmentCard = ({
  appointment,
  highlightPending,
  onView,
  onReschedule,
  onReview,
}: {
  appointment: Appointment;
  highlightPending?: boolean;
  onView: () => void;
  onReschedule: () => void;
  onReview?: () => void;
}) => {
  const group = appointmentGroup(appointment.status);
  const service = appointment.service?.name ?? 'Appointment';
  const pendingStyle = highlightPending && group === 'pending';
  const when = `${appointmentDate(appointment)} at ${appointmentTime(appointment)}`;

  return (
    <View style={[styles.card, pendingStyle && styles.cardPending]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, pendingStyle && styles.cardIconPending]}>
          <Icon name={pendingStyle ? 'time-outline' : 'calendar-outline'} size={22} color={pendingStyle ? '#a16207' : guestColors.primary} />
        </View>
        <View style={styles.flex}>
          <View style={styles.cardHeading}>
            <Text style={styles.cardTitle}>{service}</Text>
            {!(highlightPending && group !== 'pending') && <StatusBadge group={group} />}
          </View>
          <Text style={styles.cardMeta}>{[appointment.dentist?.name, appointment.clinic?.name].filter(Boolean).join(' · ')}</Text>
          <Text style={[styles.cardWhen, pendingStyle && styles.cardWhenPending]}>
            {pendingStyle ? `Awaiting clinic approval · Requested ${when}` : when}
          </Text>
          {appointment.sync_status ? (
            <Text style={[styles.sync, appointment.sync_status === 'failed' && styles.syncFailed]}>
              {appointment.sync_status === 'failed'
                ? `Not synced: ${appointment.sync_error ?? 'rejected by the server'}`
                : 'Saved offline · waiting to sync'}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.cardActions}>
        {!highlightPending && group === 'pending' && <Text style={styles.awaiting}>Awaiting Approval</Text>}
        {group === 'upcoming' && canReschedule(appointment) && (
          <OutlineButton label="Reschedule" accessibilityLabel={`Reschedule ${service}`} onPress={onReschedule} style={styles.smallButton} />
        )}
        {group === 'completed' && !appointment.has_review && onReview && (
          <OutlineButton label="Review" accessibilityLabel={`Review ${service}`} onPress={onReview} style={styles.smallButton} />
        )}
        <PrimaryButton label="View" accessibilityLabel={`View ${service} on ${when}`} onPress={onView} style={styles.smallButton} />
      </View>
    </View>
  );
};

const WEEK_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Dates grouped by month, each month with leading blanks so weekdays line up (Monday first). */
export const calendarMonths = (dates: string[]) => {
  const months: Array<{ title: string; cells: Array<string | null> }> = [];
  dates.forEach((key) => {
    const title = formatDateKey(key, { month: 'long', year: 'numeric' }).toUpperCase();
    let month = months[months.length - 1];
    if (!month || month.title !== title) {
      const [y, m, d] = key.split('-').map(Number);
      const mondayFirst = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
      month = { title, cells: Array(mondayFirst).fill(null) };
      months.push(month);
    }
    month.cells.push(key);
  });
  return months;
};

/** `open` is the set of dates that can be chosen; null while it is still loading. */
export const CalendarPicker = ({
  dates,
  open,
  selected,
  onSelect,
}: {
  dates: string[];
  open: Set<string> | null;
  selected: string | null;
  onSelect: (date: string) => void;
}) => (
  <View style={styles.calendar}>
    {calendarMonths(dates).map((month) => (
      <View key={month.title}>
        <Text style={styles.sectionLabel}>{month.title}</Text>
        <View style={styles.calendarRow}>
          {WEEK_LABELS.map((label) => (
            <Text key={label} style={styles.weekLabel}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {month.cells.map((key, index) => {
            if (!key) {
              return <View key={`blank-${index}`} style={styles.dayCell} />;
            }
            const isOpen = Boolean(open?.has(key));
            const isSelected = key === selected;
            return (
              <View key={key} style={styles.dayCell}>
                <TouchableOpacity
                  style={[styles.day, isSelected && styles.daySelected]}
                  onPress={() => onSelect(key)}
                  disabled={!isOpen}
                  accessibilityRole="button"
                  accessibilityLabel={formatDateKey(key, { weekday: 'long', month: 'long', day: 'numeric' })}
                  accessibilityState={{ selected: isSelected, disabled: !isOpen }}
                >
                  <Text style={[styles.dayText, !isOpen && styles.dayTextClosed, isSelected && styles.dayTextSelected]}>{Number(key.slice(8))}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>
    ))}
  </View>
);

export const TimeSlots = ({ slots, selected, onSelect }: { slots: Slot[]; selected: Slot | null; onSelect: (slot: Slot) => void }) => (
  <View style={styles.slots}>
    {slots.map((slot) => {
      const isSelected = selected?.startsAt === slot.startsAt;
      return (
        <TouchableOpacity
          key={slot.startsAt}
          style={[styles.slot, isSelected && styles.slotSelected]}
          onPress={() => onSelect(slot)}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
        >
          <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>{formatClockTime(slot.time)}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

export const SectionLabel = ({ children }: { children: string }) => <Text style={styles.sectionLabel}>{children}</Text>;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badge: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', marginBottom: spacing.md },
  backText: { fontSize: 14, lineHeight: 20, color: guestColors.text },

  notice: {
    flexDirection: 'row',
    gap: spacing.base,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f3e2a6',
    backgroundColor: '#fdf8e8',
  },
  noticeDanger: { borderColor: '#f8c4c4', backgroundColor: '#fdecec' },
  noticeTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#a16207' },
  noticeText: { fontSize: 13, lineHeight: 19, color: '#a16207' },
  noticeTextDanger: { color: '#c81e1e' },

  success: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  successTitle: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: guestColors.text, textAlign: 'center' },
  successText: { ...type.bodyMd, color: guestColors.textMuted, textAlign: 'center' },
  successButton: { marginTop: spacing.sm, minWidth: 200 },

  modalRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(19,33,59,0.45)' },
  modalCard: { width: '100%', maxWidth: 420, alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: 16, backgroundColor: guestColors.surface },
  modalActions: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.sm },
  danger: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#ef3b3b' },
  dangerText: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: '#ffffff' },

  card: { padding: spacing.md, gap: spacing.sm, borderRadius: 16, borderWidth: 1, borderColor: guestColors.border, backgroundColor: guestColors.surface },
  cardPending: { borderColor: '#f3e2a6', backgroundColor: '#fdf8e8' },
  cardTop: { flexDirection: 'row', gap: spacing.sm },
  cardIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: guestColors.primarySoft },
  cardIconPending: { backgroundColor: '#fdeeb5' },
  cardHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.base },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: guestColors.text },
  cardMeta: { ...type.bodyMd, color: guestColors.textMuted },
  cardWhen: { fontSize: 13, lineHeight: 18, color: guestColors.textMuted },
  cardWhenPending: { color: '#a16207' },
  sync: { fontSize: 12, lineHeight: 16, color: guestColors.textMuted, marginTop: 2 },
  syncFailed: { color: guestColors.error },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.base },
  smallButton: { minHeight: 38, paddingVertical: spacing.xs },
  awaiting: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#a16207',
    backgroundColor: '#fdf8e8',
    borderWidth: 1,
    borderColor: '#f3e2a6',
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },

  sectionLabel: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0.6, color: guestColors.text, marginBottom: spacing.base },
  calendar: { gap: spacing.md },
  calendarRow: { flexDirection: 'row' },
  weekLabel: { width: '14.28%', textAlign: 'center', fontSize: 12, lineHeight: 24, color: guestColors.textMuted },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', padding: 2 },
  day: { height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  daySelected: { backgroundColor: guestColors.primary },
  dayText: { fontSize: 14, fontWeight: '500', color: guestColors.text },
  dayTextClosed: { color: '#c5cad6' },
  dayTextSelected: { color: '#ffffff' },

  slots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.base },
  slot: { width: '48.5%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: guestColors.border, backgroundColor: guestColors.surface },
  slotSelected: { backgroundColor: guestColors.primary, borderColor: guestColors.primary },
  slotText: { fontSize: 14, lineHeight: 20, color: guestColors.text },
  slotTextSelected: { color: '#ffffff', fontWeight: '600' },
});
