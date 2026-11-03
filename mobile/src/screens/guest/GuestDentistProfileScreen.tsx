// One dentist's public profile, laid out like the website's.
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSync } from '../../context/SyncContext';
import { useBookClinic } from '../../components/guest/GuestClinicCard';
import GuestShell, { GuestFooter } from '../../components/guest/GuestShell';
import {
  DENTIST_ACCENT,
  Card,
  CardTitle,
  guestColors,
  initialOf,
  Message,
  PrimaryButton,
  reviewsLabel,
  Stars,
} from '../../components/guest/GuestUi';
import { useCachedResource } from '../../components/guest/useCachedResource';
import { workingHours } from '../../components/guest/workingHours';
import { fetchDentist, getCachedDentist } from '../../services/offline/publicRepository';
import { spacing, type } from '../../theme/tokens';

const Credential = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.credential}>
    <Icon name={icon} size={20} color={guestColors.primary} />
    <View style={styles.flex}>
      <Text style={styles.credentialLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.credentialValue}>{value}</Text>
    </View>
  </View>
);

const GuestDentistProfileScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const id: number = route.params.id;
  const { isOnline } = useSync();
  const book = useBookClinic(navigation);
  const profile = useCachedResource(
    `dentist:${id}`,
    () => getCachedDentist(id),
    () => fetchDentist(id),
  );
  const dentist = profile.data;

  if (!dentist) {
    return (
      <GuestShell navigation={navigation} patientTitle="Dentist Profile">
        {profile.loading ? (
          <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />
        ) : (
          <Message
            icon={profile.notFound ? 'alert-circle-outline' : 'cloud-offline-outline'}
            title={profile.notFound ? 'Dentist not found' : isOnline ? 'Could not load this dentist' : 'Not saved on this device'}
            body={profile.notFound ? 'This dentist may no longer be listed.' : 'Please check your connection and try again.'}
            actionLabel="Try again"
            onAction={profile.reload}
          />
        )}
      </GuestShell>
    );
  }

  const clinic = dentist.clinics[0];
  const years = dentist.yearsExperience;
  const hoursKnown = dentist.schedules.length > 0 || isOnline;

  return (
    <GuestShell navigation={navigation} patientTitle="Dentist Profile">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.banner} />
        <View style={styles.content}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialOf(dentist.name)}</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.name} accessibilityRole="header">
              {dentist.name}
            </Text>
            {dentist.isAvailable && <Text style={styles.accepting}>Accepting Patients</Text>}
          </View>
          <Text style={styles.meta}>{[dentist.specialization ?? 'General Dentistry', clinic?.name].filter(Boolean).join(' · ')}</Text>
          {dentist.rating !== null ? (
            <View style={styles.ratingRow}>
              <Stars rating={dentist.rating} size={15} />
              <Text style={styles.ratingText}>
                {dentist.rating.toFixed(1)} ({reviewsLabel(dentist.reviewCount)})
              </Text>
            </View>
          ) : (
            <Text style={styles.ratingText}>No reviews yet</Text>
          )}
          {clinic && <PrimaryButton label="Book Appointment" onPress={() => book(clinic.id, dentist.id)} style={styles.book} />}

          <View style={styles.cards}>
            <Card>
              <CardTitle>About</CardTitle>
              <Text style={styles.text}>{dentist.bio ?? 'This dentist has not added a description yet.'}</Text>
            </Card>

            <Card>
              <CardTitle>Credentials</CardTitle>
              <View style={styles.credentials}>
                <Credential icon="ribbon-outline" label="Education" value={dentist.qualifications ?? 'Not provided'} />
                <Credential icon="time-outline" label="Experience" value={`${years} ${years === 1 ? 'year' : 'years'}`} />
                {clinic && <Credential icon="business-outline" label="Clinic" value={clinic.name} />}
              </View>
            </Card>

            <Card>
              <CardTitle>Working Hours</CardTitle>
              {hoursKnown ? (
                workingHours(dentist.schedules.map(({ day, startsAt, endsAt }) => ({ day, start: startsAt, end: endsAt }))).map((row, index) => (
                  <View key={row.days} style={[styles.hoursRow, index > 0 && styles.hoursDivider]}>
                    <Text style={styles.hoursDays}>{row.days}</Text>
                    <Text style={styles.hoursText}>{row.text}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.text}>Open this profile once while online to keep the hours on your device.</Text>
              )}
            </Card>

            {clinic && (
              <Card>
                <CardTitle>Clinic</CardTitle>
                <Text style={styles.clinicName}>{clinic.name}</Text>
                <Text style={styles.text}>{clinic.address}</Text>
                <TouchableOpacity
                  style={styles.clinicLink}
                  onPress={() => navigation.navigate('GuestClinicDetails', { id: clinic.id })}
                  accessibilityRole="link"
                  accessibilityLabel={`View ${clinic.name}`}
                >
                  <Text style={styles.clinicLinkText}>View Clinic</Text>
                  <Icon name="arrow-forward" size={14} color={guestColors.primary} />
                </TouchableOpacity>
              </Card>
            )}
          </View>
        </View>
        <GuestFooter navigation={navigation} />
      </ScrollView>
    </GuestShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 64 },
  banner: { height: 120, backgroundColor: DENTIST_ACCENT },
  content: { paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl },
  avatar: {
    width: 96,
    height: 96,
    marginTop: -48,
    marginBottom: spacing.sm,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: DENTIST_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 36, lineHeight: 44, fontWeight: '700', color: '#ffffff' },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: guestColors.text },
  accepting: {
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
  meta: { ...type.bodyLg, color: guestColors.textMuted },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  ratingText: { fontSize: 14, lineHeight: 20, color: guestColors.text },
  book: { marginTop: spacing.lg },
  cards: { gap: spacing.md, marginTop: spacing.xl },
  text: { ...type.bodyLg, color: guestColors.textMuted },
  credentials: { gap: spacing.md },
  credential: { flexDirection: 'row', gap: spacing.sm },
  credentialLabel: { fontSize: 12, lineHeight: 18, letterSpacing: 0.4, color: guestColors.textMuted },
  credentialValue: { fontSize: 16, lineHeight: 24, color: guestColors.text },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
  hoursDivider: { borderTopWidth: 1, borderTopColor: guestColors.border },
  hoursDays: { fontSize: 14, lineHeight: 20, color: guestColors.textMuted },
  hoursText: { fontSize: 14, lineHeight: 20, color: guestColors.text },
  clinicName: { fontSize: 16, lineHeight: 24, color: guestColors.primary, marginBottom: spacing.xs },
  clinicLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm },
  clinicLinkText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.primary },
});

export default GuestDentistProfileScreen;
