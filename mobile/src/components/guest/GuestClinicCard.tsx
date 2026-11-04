// Clinic card shared by the home page and the directory, as on the website.
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { ClinicSummary } from '../../services/offline/publicRepository';
import { spacing, type } from '../../theme/tokens';
import { ClinicPhoto, FEATURED_ACCENT, guestColors, OutlineButton, PrimaryButton, reviewsLabel } from './GuestUi';

/** Booking needs an account: guests choose between signing in and registering. */
export const promptSignInToBook = (navigation: any) =>
  Alert.alert('Sign in to book', 'Create a free account or log in to book an appointment.', [
    { text: 'Not now', style: 'cancel' },
    { text: 'Log In', onPress: () => navigation.navigate('Login') },
    { text: 'Register', onPress: () => navigation.navigate('Register') },
  ]);

/** Signed-in patients go straight to booking; guests are asked to sign in first. */
export const useBookClinic = (navigation: any) => {
  const { isAuthenticated } = useAuth();
  return (clinicId?: number, dentistId?: number) =>
    isAuthenticated ? navigation.navigate('BookAppointment', { clinicId, dentistId }) : promptSignInToBook(navigation);
};

const GuestClinicCard = ({ clinic, navigation, color = FEATURED_ACCENT }: { clinic: ClinicSummary; navigation: any; color?: string }) => {
  const book = useBookClinic(navigation);
  return (
  <View style={styles.card}>
    <ClinicPhoto color={color} uri={clinic.image} style={styles.photo}>
      {clinic.isVerified && (
        <View style={styles.verified}>
          <Icon name="shield-checkmark-outline" size={13} color={guestColors.successText} />
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      )}
      <View style={styles.rating}>
        <Icon name="star" size={14} color={guestColors.rating} />
        <Text style={styles.ratingText}>
          {clinic.rating.toFixed(1)} ({reviewsLabel(clinic.reviewCount)})
        </Text>
      </View>
    </ClinicPhoto>

    <View style={styles.body}>
      <Text style={styles.name}>{clinic.name}</Text>
      <View style={styles.location}>
        <Icon name="location-outline" size={16} color={guestColors.textMuted} />
        <Text style={styles.locationText}>{clinic.fullAddress || clinic.city}</Text>
      </View>
      {clinic.specializations.length > 0 && (
        <View style={styles.tags}>
          {clinic.specializations.map((specialization) => (
            <Text key={specialization.name} style={styles.tag}>
              {specialization.name}
            </Text>
          ))}
        </View>
      )}
      <PrimaryButton
        label="Book Appointment"
        accessibilityLabel={`Book an appointment at ${clinic.name}`}
        onPress={() => book(clinic.id)}
      />
      <OutlineButton
        label="View Details"
        accessibilityLabel={`View details of ${clinic.name}`}
        onPress={() => navigation.navigate('GuestClinicDetails', { id: clinic.id })}
      />
    </View>
  </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: guestColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: guestColors.border,
    overflow: 'hidden',
  },
  photo: { height: 170 },
  verified: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.base,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: guestColors.surface,
  },
  verifiedText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: guestColors.successText },
  rating: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: guestColors.surface,
  },
  ratingText: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: guestColors.text },
  body: { padding: spacing.md, gap: spacing.sm },
  name: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: guestColors.primary },
  location: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  locationText: { ...type.bodyMd, flex: 1, color: guestColors.textMuted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base },
  tag: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: guestColors.successText,
    backgroundColor: guestColors.successSoft,
    borderWidth: 1,
    borderColor: guestColors.successBorder,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
});

export default GuestClinicCard;
