// Building blocks shared by the clinic portal screens (cards, fields,
// buttons, chips, sheets, status badges, load states), styled with the
// clinic admin design tokens so every section looks the same.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  KeyboardTypeOptions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { serverMessage, statusLabel } from '../../services/clinicPortal';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';

// ---------------------------------------------------------------- Data loading
/**
 * Loads data for a screen and reloads when `deps` change. `reload()` shows
 * the spinner again; `refresh()` is for pull-to-refresh.
 */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[], fallback = 'This could not be loaded.') {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (err) {
      setError(serverMessage(err, fallback));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fallback]);

  useEffect(() => {
    setLoading(true);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    data,
    setData,
    error,
    loading,
    refreshing,
    reload: () => {
      setLoading(true);
      return run();
    },
    refresh: () => {
      setRefreshing(true);
      return run();
    },
    /** Reload quietly (after a save) without the full-screen spinner. */
    sync: run,
  };
}

/** Quietly reloads when the page comes back into view (e.g. after a detail page). */
export function useRefreshOnFocus(sync: () => unknown) {
  const first = useRef(true);
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      syncRef.current();
    }, []),
  );
}

export function LoadState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry?: () => void }) {
  if (loading) return <ActivityIndicator style={styles.loading} size="large" color={palette.primary} />;
  if (!error) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{error}</Text>
      {onRetry && <Button label="Try again" onPress={onRetry} small />}
    </View>
  );
}

export const EmptyState = ({ icon = 'file-tray-outline', text }: { icon?: string; text: string }) => (
  <View style={styles.empty}>
    <Icon name={icon} size={36} color={palette.outline} />
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

// ---------------------------------------------------------------- Layout
export function Card({
  title,
  subtitle,
  action,
  children,
  style,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]}>
      {(title || action) && (
        <View style={styles.cardHeader}>
          <View style={styles.flex}>
            {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
            {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value === null || value === undefined || value === '' ? '—' : String(value)}</Text>
  </View>
);

export function StatGrid({ stats }: { stats: { label: string; value: string | number; icon?: string; tone?: 'primary' | 'danger' | 'success' }[] }) {
  return (
    <View style={styles.stats}>
      {stats.map((s) => (
        <View key={s.label} style={styles.stat}>
          {s.icon ? (
            <View style={[styles.statIcon, s.tone === 'danger' ? styles.toneDanger : s.tone === 'success' ? styles.toneSuccess : styles.tonePrimary]}>
              <Icon
                name={s.icon}
                size={18}
                color={s.tone === 'danger' ? palette.error : s.tone === 'success' ? palette.onSecondaryContainer : palette.primary}
              />
            </View>
          ) : null}
          <View style={styles.flex}>
            <Text style={styles.statLabel} numberOfLines={2}>{s.label}</Text>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- Controls
type ButtonVariant = 'primary' | 'outline' | 'tonal' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  busy,
  disabled,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: string;
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = variant === 'primary' ? palette.onPrimary : variant === 'danger' ? palette.error : palette.primary;
  return (
    <TouchableOpacity
      style={[styles.button, styles[`button_${variant}`], small && styles.buttonSmall, (disabled || busy) && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: fg }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  multiline,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  required,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.outline}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        accessibilityLabel={label}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (value: boolean) => void; hint?: string }) {
  return (
    <View style={styles.toggle}>
      <View style={styles.flex}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: palette.primaryContainer, false: palette.surfaceContainerHighest }}
        thumbColor={palette.surfaceContainerLowest}
        accessibilityLabel={label}
      />
    </View>
  );
}

export type ChipOption<T extends string | number> = { id: T; label: string };

/** Single-choice chips (filters, record types, movement types). */
export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  scroll = true,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  scroll?: boolean;
}) {
  const chips = options.map((o) => {
    const active = o.id === value;
    return (
      <TouchableOpacity
        key={String(o.id)}
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => onChange(o.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
      </TouchableOpacity>
    );
  });
  return scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {chips}
    </ScrollView>
  ) : (
    <View style={[styles.chips, styles.chipsWrap]}>{chips}</View>
  );
}

/** Pick one option from a list shown in place (works inside sheets). */
export function SelectField<T extends string | number>({
  label,
  options,
  value,
  onChange,
  placeholder = 'Choose…',
  required,
}: {
  label: string;
  options: ChipOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TouchableOpacity
        style={styles.select}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.selectText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={palette.onSurfaceVariant} />
      </TouchableOpacity>
      {open && (
        <View style={styles.options}>
          {options.length === 0 ? <Text style={[styles.muted, styles.optionEmpty]}>Nothing to choose from yet.</Text> : null}
          {options.map((o) => (
            <TouchableOpacity
              key={String(o.id)}
              style={[styles.option, o.id === value && styles.optionActive]}
              onPress={() => {
                onChange(o.id);
                setOpen(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: o.id === value }}
            >
              <Icon name={o.id === value ? 'radio-button-on' : 'radio-button-off'} size={18} color={palette.primary} />
              <Text style={styles.optionText}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- Status
const BADGE_TONES: Record<string, { bg: string; fg: string }> = {
  success: { bg: 'rgba(103,252,198,0.35)', fg: palette.onSecondaryContainer },
  info: { bg: palette.primaryFixed, fg: palette.primary },
  warning: { bg: '#fef3c7', fg: '#92400e' },
  danger: { bg: palette.errorContainer, fg: palette.onErrorContainer },
  neutral: { bg: palette.surfaceContainerHigh, fg: palette.onSurfaceVariant },
};

const STATUS_TONES: Record<string, keyof typeof BADGE_TONES> = {
  pending: 'warning',
  reschedule_requested: 'warning',
  confirmed: 'info',
  checked_in: 'info',
  in_progress: 'info',
  completed: 'success',
  approved: 'success',
  active: 'success',
  published: 'success',
  cancelled: 'neutral',
  rejected: 'danger',
  no_show: 'danger',
  suspended: 'danger',
  inactive: 'neutral',
  low: 'danger',
  expired: 'danger',
  expiring: 'warning',
};

export function Badge({ status, label, tone }: { status?: string; label?: string; tone?: keyof typeof BADGE_TONES }) {
  const colors = BADGE_TONES[tone ?? STATUS_TONES[status ?? ''] ?? 'neutral'];
  return (
    <Text style={[styles.badge, { backgroundColor: colors.bg, color: colors.fg }]} numberOfLines={1}>
      {label ?? statusLabel(status ?? '')}
    </Text>
  );
}

// ---------------------------------------------------------------- Bottom sheet
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.iconButton}>
              <Icon name="close" size={24} color={palette.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const FormError = ({ message }: { message?: string | null }) =>
  message ? (
    <Text style={styles.formError} accessibilityRole="alert">
      {message}
    </Text>
  ) : null;

export const SearchBox = ({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) => (
  <View style={styles.search}>
    <Icon name="search" size={18} color={palette.outline} />
    <TextInput
      style={styles.searchInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={palette.outline}
      accessibilityLabel={placeholder}
      autoCapitalize="none"
      returnKeyType="search"
    />
    {value ? (
      <TouchableOpacity onPress={() => onChangeText('')} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.searchClear}>
        <Icon name="close-circle" size={18} color={palette.outline} />
      </TouchableOpacity>
    ) : null}
  </View>
);

export const Pager = ({ page, lastPage, onChange }: { page: number; lastPage: number; onChange: (page: number) => void }) =>
  lastPage > 1 ? (
    <View style={styles.pager}>
      <Button label="Previous" variant="outline" small icon="chevron-back" disabled={page <= 1} onPress={() => onChange(page - 1)} />
      <Text style={styles.muted}>
        Page {page} of {lastPage}
      </Text>
      <Button label="Next" variant="outline" small disabled={page >= lastPage} onPress={() => onChange(page + 1)} />
    </View>
  ) : null;

export const ui = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  muted: { ...type.bodyMd, color: palette.onSurfaceVariant },
  small: { fontSize: 12, color: palette.onSurfaceVariant },
  title: { ...type.bodyLg, fontWeight: '600', color: palette.onSurface },
  heading: { ...type.titleLg, color: palette.onSurface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  flex: { flex: 1 },
  divider: { height: 1, backgroundColor: palette.surfaceContainerHigh, marginVertical: spacing.sm },
  listItem: {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceContainerLowest,
    gap: spacing.xs,
  },
  success: { ...type.bodyMd, color: palette.secondary },
  spacedTop: { marginTop: spacing.md },
  /** List header block: title, search, filters. */
  stack: { gap: spacing.sm, marginBottom: spacing.xs },
  stackItem: { paddingVertical: spacing.xs },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { ...type.bodyMd, color: palette.onSurfaceVariant },
  loading: { marginTop: spacing.xl },
  errorBox: { padding: spacing.md, borderRadius: radius.xl, backgroundColor: palette.errorContainer, gap: spacing.sm, alignItems: 'flex-start' },
  errorText: { ...type.bodyMd, color: palette.onErrorContainer },
  empty: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  emptyText: { ...type.bodyMd, color: palette.onSurfaceVariant, textAlign: 'center' },

  card: {
    padding: spacing.md,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(194,198,212,0.3)',
    backgroundColor: palette.surfaceContainerLowest,
    gap: spacing.sm,
    ...shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...type.titleLg, color: palette.onSurface },
  infoRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 4 },
  infoLabel: { ...type.bodyMd, color: palette.onSurfaceVariant, width: 120 },
  infoValue: { ...type.bodyMd, color: palette.onSurface, flex: 1 },

  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceContainerLowest,
    ...shadow.sm,
  },
  statIcon: { padding: 8, borderRadius: radius.lg },
  tonePrimary: { backgroundColor: palette.primaryFixed },
  toneDanger: { backgroundColor: palette.errorContainer },
  toneSuccess: { backgroundColor: palette.secondaryContainer },
  statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: palette.onSurfaceVariant },
  statValue: { ...type.headlineMd, fontWeight: '700', color: palette.onSurface },

  button: { flexDirection: 'row', gap: spacing.xs, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  buttonSmall: { minHeight: 40, paddingHorizontal: spacing.sm, alignSelf: 'flex-start' },
  button_primary: { backgroundColor: palette.primary },
  button_outline: { borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest },
  button_tonal: { backgroundColor: palette.primaryFixed },
  button_danger: { borderWidth: 1, borderColor: palette.errorContainer, backgroundColor: palette.surfaceContainerLowest },
  buttonText: { fontWeight: '600', fontSize: 16 },
  buttonTextSmall: { fontSize: 14 },
  disabled: { opacity: 0.5 },

  field: { marginTop: spacing.sm },
  fieldLabel: { ...type.labelMd, color: palette.onSurface, marginBottom: spacing.xs },
  required: { color: palette.error },
  input: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.outlineVariant, ...type.bodyLg, color: palette.onSurface, backgroundColor: palette.surfaceContainerLowest },
  inputMultiline: { minHeight: 96, paddingTop: spacing.sm },
  hint: { fontSize: 12, color: palette.onSurfaceVariant, marginTop: 4 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, marginTop: spacing.sm },
  toggleLabel: { ...type.bodyMd, color: palette.onSurface },

  chips: { gap: spacing.base, paddingVertical: 2 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center', borderRadius: radius.lg, backgroundColor: palette.surfaceContainerHigh },
  chipActive: { backgroundColor: palette.primary },
  chipText: { ...type.labelMd, color: palette.onSurfaceVariant },
  chipTextActive: { color: palette.onPrimary },

  select: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest },
  selectText: { ...type.bodyLg, color: palette.onSurface, flex: 1 },
  placeholder: { color: palette.outline },
  options: { marginTop: spacing.xs, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.outlineVariant, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm },
  optionActive: { backgroundColor: palette.primaryFixed },
  optionText: { ...type.bodyMd, color: palette.onSurface, flex: 1 },
  optionEmpty: { padding: spacing.sm },

  badge: { alignSelf: 'flex-start', overflow: 'hidden', paddingHorizontal: spacing.base, paddingVertical: 3, borderRadius: radius.full, fontSize: 11, fontWeight: '700' },

  scrim: { flex: 1, backgroundColor: palette.scrim },
  sheet: { maxHeight: '88%', paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, backgroundColor: palette.surfaceContainerLowest },
  sheetHeader: { flexDirection: 'row', alignItems: 'center' },
  sheetTitle: { ...type.titleLg, color: palette.onSurface, flex: 1 },
  sheetBody: { paddingBottom: spacing.xl, gap: spacing.xs },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  formError: { ...type.bodyMd, color: palette.error, marginTop: spacing.sm },

  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, paddingHorizontal: spacing.md, minHeight: 44, borderRadius: radius.full, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLow },
  searchInput: { flex: 1, ...type.bodyMd, color: palette.onSurface, paddingVertical: spacing.base },
  searchClear: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
});
