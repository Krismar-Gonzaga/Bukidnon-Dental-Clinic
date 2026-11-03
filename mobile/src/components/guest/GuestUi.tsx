// Building blocks of the guest pages, using the website's colours (web/src/styles/tokens.css)
// so that the app and the site look the same.
import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { shadow, spacing, type } from '../../theme/tokens';

export const guestColors = {
  primary: '#0b3b8c',
  accent: '#1e9e5a',
  background: '#f5f7fb',
  surface: '#ffffff',
  text: '#13213b',
  textMuted: '#5a6680',
  border: '#dde3ee',
  rating: '#f5a524',
  starEmpty: '#dde3ee',
  error: '#c62828',
  successText: '#13784a',
  successSoft: '#ecfbf3',
  successBorder: '#b6e6cb',
  neutralSoft: '#f1f3f7',
  primarySoft: '#eaf0fb',
};

// Stand-ins for clinic photos. The site uses a gradient between two tones of each; the
// app has no gradient library, so it uses a solid colour in the same order.
const ACCENTS = ['#2f80f7', '#0fbfa0', '#a43ff0', '#f2245a', '#fb6b0a', '#06b0d8'];
const DIRECTORY_ACCENTS = ['#0fbfa0', '#2f80f7', '#a43ff0', '#f2245a', '#fb6b0a', '#06b0d8'];

export const FEATURED_ACCENT = ACCENTS[0];
export const DENTIST_ACCENT = ACCENTS[0];

/** Same choice as the site's accentFor, so a clinic has the same banner colour on both. */
export const accentFor = (id: number) => ACCENTS[(Number(id) || 0) % ACCENTS.length];

/** Directory cards are coloured by their position in the list, as on the site. */
export const directoryAccent = (index: number) => DIRECTORY_ACCENTS[index % DIRECTORY_ACCENTS.length];

export const initialOf = (name: string) =>
  name.replace(/^Dr\.?\s+/i, '').charAt(0).toUpperCase();

export const reviewsLabel = (count: number | undefined) => {
  const reviews = count ?? 0;
  return `${reviews} ${reviews === 1 ? 'review' : 'reviews'}`;
};

export const Stars = ({ rating, size = 16 }: { rating: number; size?: number }) => (
  <View style={styles.stars} accessibilityLabel={`Rated ${rating} out of 5`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Icon
        key={star}
        name="star"
        size={size}
        color={star <= Math.floor(rating) ? guestColors.rating : guestColors.starEmpty}
      />
    ))}
  </View>
);

export const PageIntro = ({
  eyebrow,
  title,
  description,
  centered,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  centered?: boolean;
}) => (
  <View style={[styles.intro, centered && styles.introCentered]}>
    {eyebrow ? <Text style={[styles.eyebrow, centered && styles.eyebrowCentered]}>{eyebrow.toUpperCase()}</Text> : null}
    <Text style={[styles.introTitle, centered && styles.centeredText]}>{title}</Text>
    <Text style={[styles.introText, centered && styles.centeredText]}>{description}</Text>
  </View>
);

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: string;
  /** Icon after the label instead of before it. */
  trailingIcon?: string;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export const PrimaryButton = ({ label, onPress, icon, trailingIcon, busy, disabled, style, accessibilityLabel }: ButtonProps) => (
  <TouchableOpacity
    style={[styles.button, styles.buttonPrimary, (disabled || busy) && styles.buttonDisabled, style]}
    onPress={onPress}
    disabled={disabled || busy}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
  >
    {busy ? <ActivityIndicator size="small" color="#ffffff" /> : icon ? <Icon name={icon} size={18} color="#ffffff" /> : null}
    <Text style={styles.buttonPrimaryText}>{label}</Text>
    {trailingIcon ? <Icon name={trailingIcon} size={18} color="#ffffff" /> : null}
  </TouchableOpacity>
);

export const OutlineButton = ({ label, onPress, icon, style, accessibilityLabel }: ButtonProps) => (
  <TouchableOpacity
    style={[styles.button, styles.buttonOutline, style]}
    onPress={onPress}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
  >
    {icon ? <Icon name={icon} size={18} color={guestColors.primary} /> : null}
    <Text style={styles.buttonOutlineText}>{label}</Text>
  </TouchableOpacity>
);

export const FieldLabel = ({ children }: { children: string }) => <Text style={styles.fieldLabel}>{children}</Text>;

export const SearchField = ({ icon = 'search-outline', ...input }: TextInputProps & { icon?: string }) => (
  <View style={styles.field}>
    <Icon name={icon} size={18} color={guestColors.textMuted} />
    <TextInput style={styles.fieldInput} placeholderTextColor={guestColors.textMuted} returnKeyType="search" {...input} />
  </View>
);

export const SelectField = ({
  icon,
  value,
  onPress,
  accessibilityLabel,
}: {
  icon: string;
  value: string;
  onPress: () => void;
  accessibilityLabel: string;
}) => (
  <TouchableOpacity style={styles.field} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
    <Icon name={icon} size={18} color={guestColors.textMuted} />
    <Text style={styles.fieldValue} numberOfLines={1}>
      {value}
    </Text>
    <Icon name="chevron-down" size={16} color={guestColors.textMuted} />
  </TouchableOpacity>
);

export const Card = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const CardTitle = ({ children }: { children: string }) => <Text style={styles.cardTitle}>{children}</Text>;

export const Message = ({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <View style={styles.message}>
    <Icon name={icon} size={40} color={guestColors.textMuted} />
    <Text style={styles.messageTitle}>{title}</Text>
    {body ? <Text style={styles.messageBody}>{body}</Text> : null}
    {actionLabel && onAction ? <OutlineButton label={actionLabel} onPress={onAction} style={styles.messageAction} /> : null}
  </View>
);

export const Avatar = ({ name, color, size = 40 }: { name: string; color: string; size?: number }) => (
  <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
    <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initialOf(name)}</Text>
  </View>
);

/** Clinic photo, or the coloured stand-in with a building icon when there is none. */
export const ClinicPhoto = ({
  color,
  uri,
  style,
  children,
}: {
  color: string;
  uri: string | null;
  style: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) => (
  <View style={[style, styles.photo, { backgroundColor: color }]}>
    {uri ? (
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
    ) : (
      <Icon name="business-outline" size={56} color="rgba(255,255,255,0.45)" />
    )}
    {children}
  </View>
);

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 2 },

  intro: {
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.lg,
    backgroundColor: guestColors.background,
    borderBottomWidth: 1,
    borderBottomColor: guestColors.border,
  },
  introCentered: { alignItems: 'center' },
  centeredText: { textAlign: 'center' },
  eyebrow: {
    alignSelf: 'flex-start',
    ...type.labelMd,
    color: '#ffffff',
    backgroundColor: '#0056b3',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginBottom: spacing.sm,
  },
  eyebrowCentered: { alignSelf: 'center' },
  introTitle: { fontSize: 30, lineHeight: 38, fontWeight: '700', color: guestColors.primary, marginBottom: spacing.sm },
  introText: { ...type.bodyLg, color: guestColors.text },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  buttonPrimary: { backgroundColor: guestColors.primary },
  buttonDisabled: { opacity: 0.6 },
  buttonPrimaryText: { flexShrink: 1, fontSize: 15, lineHeight: 20, fontWeight: '600', color: '#ffffff', textAlign: 'center' },
  buttonOutline: { borderWidth: 1, borderColor: guestColors.primary, backgroundColor: guestColors.surface },
  buttonOutlineText: { flexShrink: 1, fontSize: 15, lineHeight: 20, fontWeight: '600', color: guestColors.primary, textAlign: 'center' },

  fieldLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.text, marginBottom: spacing.base },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    backgroundColor: guestColors.surface,
    borderWidth: 1,
    borderColor: guestColors.border,
    borderRadius: 10,
  },
  fieldInput: { ...type.bodyMd, flex: 1, color: guestColors.text, paddingVertical: spacing.sm },
  fieldValue: { ...type.bodyMd, flex: 1, color: guestColors.text },

  card: {
    backgroundColor: guestColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: guestColors.border,
    padding: spacing.lg,
    ...shadow.sm,
  },
  cardTitle: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: guestColors.text, marginBottom: spacing.sm },

  message: { alignItems: 'center', gap: spacing.sm, paddingVertical: 48, paddingHorizontal: spacing.lg },
  messageTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: guestColors.text, textAlign: 'center' },
  messageBody: { ...type.bodyMd, color: guestColors.textMuted, textAlign: 'center' },
  messageAction: { marginTop: spacing.xs, minWidth: 140 },

  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', color: '#ffffff' },

  photo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
