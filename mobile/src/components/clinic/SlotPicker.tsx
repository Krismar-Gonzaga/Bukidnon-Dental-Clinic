// Open appointment times for one dentist and service, from the same
// availability API patients book with (the web portal's SlotPickerModal).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchAvailableDates, fetchSlots, formatClockTime, formatDateKey, Slot, upcomingBusinessDates } from '../../services/booking';
import { serverMessage } from '../../services/clinicPortal';
import { palette, radius, spacing, type } from '../../theme/tokens';

const DAYS_AHEAD = 30;

export function SlotPicker({
  clinicId,
  serviceRateId,
  dentistId,
  selected,
  onSelect,
}: {
  clinicId: number;
  serviceRateId: number;
  dentistId: number;
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
}) {
  const [dates, setDates] = useState<string[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const range = upcomingBusinessDates(DAYS_AHEAD);
    setDates(null);
    setDate(null);
    fetchAvailableDates({ clinicId, serviceRateId, dentistId, from: range[0], to: range[range.length - 1] })
      .then((list) => {
        if (cancelled) return;
        setDates(list);
        setDate(list[0] ?? null);
        setError(null);
      })
      .catch((err) => !cancelled && setError(serverMessage(err, 'Open dates could not be loaded.')));
    return () => {
      cancelled = true;
    };
  }, [clinicId, serviceRateId, dentistId]);

  useEffect(() => {
    if (!date) return undefined;
    let cancelled = false;
    setSlots(null);
    fetchSlots({ clinicId, serviceRateId, dentistId, date })
      .then((list) => !cancelled && setSlots(list))
      .catch((err) => !cancelled && setError(serverMessage(err, 'Open times could not be loaded.')));
    return () => {
      cancelled = true;
    };
  }, [clinicId, serviceRateId, dentistId, date]);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!dates) return <ActivityIndicator style={styles.loading} color={palette.primary} />;
  if (dates.length === 0) return <Text style={styles.muted}>No open dates in the next {DAYS_AHEAD} days for this dentist and service.</Text>;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {dates.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.chip, d === date && styles.chipActive]}
            onPress={() => setDate(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: d === date }}
          >
            <Text style={[styles.chipText, d === date && styles.chipTextActive]}>{formatDateKey(d)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={styles.label}>Time</Text>
      {!slots ? (
        <ActivityIndicator style={styles.loading} color={palette.primary} />
      ) : slots.length === 0 ? (
        <Text style={styles.muted}>No open times on this date.</Text>
      ) : (
        <View style={styles.grid}>
          {slots.map((slot) => {
            const active = selected?.startsAt === slot.startsAt;
            return (
              <TouchableOpacity
                key={slot.startsAt}
                style={[styles.slot, active && styles.chipActive]}
                onPress={() => onSelect(slot)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{formatClockTime(slot.time)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...type.labelMd, color: palette.onSurface, marginTop: spacing.sm },
  muted: { ...type.bodyMd, color: palette.onSurfaceVariant, marginTop: spacing.sm },
  error: { ...type.bodyMd, color: palette.error, marginTop: spacing.sm },
  loading: { marginVertical: spacing.md },
  row: { gap: spacing.base },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base },
  chip: { paddingHorizontal: spacing.md, minHeight: 40, justifyContent: 'center', borderRadius: radius.lg, backgroundColor: palette.surfaceContainerHigh },
  slot: { width: '30%', minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: palette.surfaceContainerHigh },
  chipActive: { backgroundColor: palette.primary },
  chipText: { ...type.labelMd, color: palette.onSurface },
  chipTextActive: { color: palette.onPrimary },
});
