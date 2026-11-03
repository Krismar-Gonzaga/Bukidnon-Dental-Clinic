// Summary cards of the admin data screens (web: components/admin/AdminData.jsx MetricCard).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';

export type Metric = {
  label: string;
  value: string;
  note?: string;
  icon?: string;
  tone?: 'default' | 'primary' | 'danger' | 'success';
};

const TONE_COLORS = { default: palette.onSurface, primary: palette.primary, danger: palette.error, success: palette.secondary };

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <View style={styles.grid}>
      {metrics.map((m) => (
        <View key={m.label} style={styles.card} accessible accessibilityLabel={`${m.label}: ${m.value}${m.note ? `. ${m.note}` : ''}`}>
          <Text style={styles.label} numberOfLines={1}>{m.label.toUpperCase()}</Text>
          <Text style={[styles.value, { color: TONE_COLORS[m.tone ?? 'default'] }]} numberOfLines={1} adjustsFontSizeToFit>
            {m.value}
          </Text>
          {m.note ? (
            <View style={styles.noteRow}>
              {m.icon ? <Icon name={m.icon} size={13} color={m.tone === 'danger' ? palette.error : palette.onSurfaceVariant} /> : null}
              <Text style={[styles.note, m.tone === 'danger' && styles.noteDanger]} numberOfLines={2}>
                {m.note}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceContainerLowest,
    ...shadow.sm,
  },
  label: { ...type.labelMd, fontSize: 11, color: palette.onSurfaceVariant },
  value: { ...type.headlineMd, marginTop: spacing.xs },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  note: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: '600', color: palette.onSurfaceVariant },
  noteDanger: { color: palette.error },
});
