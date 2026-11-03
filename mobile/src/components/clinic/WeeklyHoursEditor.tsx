// Seven days (Monday first), each open or closed with start and end times
// (web: WeeklyHoursEditor). value: { [dayOfWeek]: { start, end } }; a
// missing day is closed. Used for branch hours and dentist schedules.
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { DateField } from './DateField';
import { DAYS, WEEK_ORDER } from '../../services/clinicPortal';
import { palette, radius, spacing, type } from '../../theme/tokens';

export type WeeklyHours = Record<number, { start: string; end: string }>;

const DEFAULT_DAY = { start: '08:00', end: '17:00' };

export function WeeklyHoursEditor({ value, onChange }: { value: WeeklyHours; onChange: (value: WeeklyHours) => void }) {
  const setDay = (day: number, next: { start: string; end: string } | null) => {
    const copy = { ...value };
    if (next) copy[day] = next;
    else delete copy[day];
    onChange(copy);
  };

  return (
    <View style={styles.wrap}>
      {WEEK_ORDER.map((day) => {
        const hours = value[day];
        return (
          <View key={day} style={styles.day}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{DAYS[day]}</Text>
              <Text style={styles.state}>{hours ? 'Open' : 'Closed'}</Text>
              <Switch
                value={Boolean(hours)}
                onValueChange={(open) => setDay(day, open ? DEFAULT_DAY : null)}
                trackColor={{ true: palette.primaryContainer, false: palette.surfaceContainerHighest }}
                thumbColor={palette.surfaceContainerLowest}
                accessibilityLabel={`Open on ${DAYS[day]}`}
              />
            </View>
            {hours && (
              <View style={styles.times}>
                <DateField label="From" mode="time" value={hours.start} onChange={(start) => start && setDay(day, { ...hours, start })} />
                <DateField label="To" mode="time" value={hours.end} onChange={(end) => end && setDay(day, { ...hours, end })} />
              </View>
            )}
            {hours && hours.end <= hours.start ? <Text style={styles.error}>Closing time must be after opening time.</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/** True when every open day ends after it starts. */
export const hoursAreValid = (value: WeeklyHours) => Object.values(value).every((h) => h.end > h.start);

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.sm },
  day: { padding: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayName: { ...type.bodyLg, fontWeight: '600', color: palette.onSurface, flex: 1 },
  state: { ...type.labelMd, color: palette.onSurfaceVariant },
  times: { flexDirection: 'row', gap: spacing.sm },
  error: { fontSize: 12, color: palette.error, marginTop: spacing.xs },
});
