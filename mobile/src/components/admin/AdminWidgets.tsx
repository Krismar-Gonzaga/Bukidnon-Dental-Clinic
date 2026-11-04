// Small pieces of the system admin design for phones (web: components/admin/AdminUi.jsx).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { palette, radius, spacing } from '../../theme/tokens';

/** Finished steps get a green check. */
export function WorkflowSteps({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <View style={styles.steps}>
      {steps.map((step) => (
        <View key={step.label} style={styles.step} accessible accessibilityLabel={`${step.label}${step.done ? '' : ' (not yet)'}`}>
          <View style={[styles.mark, step.done && styles.markDone]}>
            {step.done ? <Icon name="checkmark" size={14} color={palette.onPrimary} /> : <View style={styles.dot} />}
          </View>
          <Text style={[styles.stepText, step.done && styles.stepTextDone]}>{step.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Grey labelled box (PLAN, RENEWAL, ...). Two to a row. */
export function DetailTiles({ tiles }: { tiles: { label: string; value: string }[] }) {
  return (
    <View style={styles.tiles}>
      {tiles.map((tile) => (
        <View key={tile.label} style={styles.tile}>
          <Text style={styles.tileLabel}>{tile.label}</Text>
          <Text style={styles.tileValue}>{tile.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** One bar per period, tallest at full height, with its value on top. */
export function MiniBars({ rows, label }: { rows: { key: string; label: string; value: number }[]; label: string }) {
  const highest = Math.max(1, ...rows.map((row) => row.value));
  return (
    <View style={styles.bars} accessible accessibilityLabel={`${label}: ${rows.map((row) => `${row.label} ${row.value}`).join(', ')}`}>
      {rows.map((row) => (
        <View key={row.key} style={styles.barColumn}>
          <Text style={styles.barValue}>{row.value}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { height: `${Math.max(3, (row.value / highest) * 100)}%` }]} />
          </View>
          <Text style={styles.barLabel}>{row.label}</Text>
        </View>
      ))}
    </View>
  );
}

// Fixed order so a plan keeps its color; each is also named in the legend.
const SHARE_COLORS = ['#1f6fd0', '#c98500', '#0f9d7a', '#6b7280'];

/** Shares of a whole as one segmented bar with a named legend. */
export function ShareBar({ rows, label }: { rows: { key: string; name: string; total: number }[]; label: string }) {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return (
    <View accessible accessibilityLabel={`${label}: ${rows.map((row) => `${row.name} ${row.total}`).join(', ')}`}>
      <View style={styles.share}>
        {total === 0 ? null : rows.map((row, index) => (row.total > 0 ? <View key={row.key} style={{ flex: row.total, backgroundColor: SHARE_COLORS[index % SHARE_COLORS.length] }} /> : null))}
      </View>
      <View style={styles.legend}>
        {rows.map((row, index) => (
          <View key={row.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: SHARE_COLORS[index % SHARE_COLORS.length] }]} />
            <Text style={styles.legendText}>
              {row.name}: {row.total}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { gap: spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mark: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceContainerHigh },
  markDone: { backgroundColor: palette.secondary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.outline },
  stepText: { fontSize: 13, color: palette.onSurfaceVariant },
  stepTextDone: { fontWeight: '600', color: palette.onSurface },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLow },
  tileLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: palette.onSurfaceVariant },
  tileValue: { marginTop: 2, fontSize: 15, fontWeight: '500', color: palette.onSurface },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 170, marginTop: spacing.sm },
  barColumn: { flex: 1, height: '100%', alignItems: 'center' },
  barValue: { fontSize: 11, color: palette.onSurfaceVariant, marginBottom: 2 },
  barTrack: { flex: 1, width: '100%', maxWidth: 40, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: '#1f6fd0' },
  barLabel: { fontSize: 11, color: palette.onSurfaceVariant, marginTop: 4 },
  share: { flexDirection: 'row', height: 16, gap: 2, borderRadius: 4, overflow: 'hidden', backgroundColor: palette.surfaceContainerHigh, marginTop: spacing.sm },
  legend: { gap: spacing.xs, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 13, color: palette.onSurfaceVariant },
});
