// Date and time inputs for clinic forms. Values are plain strings, the
// format the API expects: "YYYY-MM-DD" for dates and "HH:MM" for times.
// Android opens the system dialog; iOS shows the picker in place.
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatClockTime, formatDateKey } from '../../services/booking';
import { palette, radius, spacing, type } from '../../theme/tokens';

const pad = (n: number) => String(n).padStart(2, '0');
const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const parse = (mode: 'date' | 'time', value: string) => {
  const now = new Date();
  if (mode === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  }
  if (mode === 'time' && /^\d{2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(':').map(Number);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  }
  return now;
};

export function DateField({
  label,
  value,
  onChange,
  mode = 'date',
  required,
  clearable,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'time';
  required?: boolean;
  clearable?: boolean;
  hint?: string;
}) {
  const [showInline, setShowInline] = useState(false);
  const display = value ? (mode === 'date' ? formatDateKey(value, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : formatClockTime(value)) : '';

  const handle = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowInline(false);
    if (event.type === 'set' && date) onChange(mode === 'date' ? toDateKey(date) : toTime(date));
  };

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: parse(mode, value), mode, onChange: handle, is24Hour: false });
    } else {
      setShowInline((s) => !s);
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.input}
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${display || 'not set'}`}
        >
          <Icon name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={18} color={palette.primary} />
          <Text style={[styles.value, !display && styles.placeholder]}>{display || (mode === 'date' ? 'Choose a date' : 'Choose a time')}</Text>
        </TouchableOpacity>
        {clearable && value ? (
          <TouchableOpacity style={styles.clear} onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel={`Clear ${label}`}>
            <Icon name="close-circle" size={20} color={palette.outline} />
          </TouchableOpacity>
        ) : null}
      </View>
      {showInline && Platform.OS === 'ios' ? (
        <DateTimePicker value={parse(mode, value)} mode={mode} display={mode === 'date' ? 'inline' : 'spinner'} onChange={handle} />
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: spacing.sm, flexGrow: 1 },
  label: { ...type.labelMd, color: palette.onSurface, marginBottom: spacing.xs },
  required: { color: palette.error },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  input: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceContainerLowest,
  },
  value: { ...type.bodyLg, color: palette.onSurface },
  placeholder: { color: palette.outline },
  clear: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 12, color: palette.onSurfaceVariant, marginTop: 4 },
});
