// Clinic details for guests, with the website's four tabs. Shows the saved copy immediately,
// refreshes it when online, and routes booking and saving through login/registration.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { useBookClinic } from '../../components/guest/GuestClinicCard';
import GuestShell, { GuestFooter } from '../../components/guest/GuestShell';
import {
  accentFor,
  Avatar,
  Card,
  CardTitle,
  guestColors,
  Message,
  PrimaryButton,
  reviewsLabel,
  Stars,
} from '../../components/guest/GuestUi';
import { openDaysSummary } from '../../components/guest/workingHours';
import { isNetworkError, patientService } from '../../services/api';
import {
  ClinicBranch,
  ClinicDentist,
  ClinicDetails,
  ClinicReview,
  ClinicService,
  ClinicSummary,
  fetchClinicDetails,
  getCachedClinicDetails,
} from '../../services/offline/publicRepository';
import { spacing, type } from '../../theme/tokens';
import { formatClock, formatPrice, timeAgo } from '../../utils/format';

type TabKey = 'overview' | 'dentists' | 'services' | 'reviews';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'dentists', label: 'Dentists' },
  { key: 'services', label: 'Services' },
  { key: 'reviews', label: 'Reviews' },
];

const GALLERY_OPACITY = [1, 0.7, 0.4];

const branchHours = (branch: ClinicBranch) =>
  openDaysSummary(branch.hours.map(({ day, opensAt, closesAt }) => ({ day, start: opensAt, end: closesAt })));

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Icon name={icon} size={18} color={guestColors.primary} />
    <View style={styles.flex}>
      <Text style={styles.infoLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const GuestClinicDetailsScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const id: number = route.params.id;
  const { isReady, isOnline } = useSync();
  const { isAuthenticated } = useAuth();
  const book = useBookClinic(navigation);
  const [saved, setSaved] = useState(false);

  const [clinic, setClinic] = useState<ClinicSummary | ClinicDetails | null>(null);
  const [reviews, setReviews] = useState<ClinicReview[] | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>('overview');

  const load = useCallback(async () => {
    // 1. Local copy first, so the page appears instantly (and offline).
    const cached = await getCachedClinicDetails(id);
    if (cached) {
      setClinic(cached.clinic);
      setReviews(cached.reviews);
      setSavedAt(cached.updatedAt);
    }
    setLoading(false);

    // 2. Then refresh from the server when it's reachable.
    setRefreshing(true);
    try {
      const fresh = await fetchClinicDetails(id);
      setClinic(fresh);
      setReviews(fresh.reviews);
      setSavedAt(Date.now());
    } catch (error) {
      if (!isNetworkError(error)) {
        console.error('Failed to refresh clinic details:', error);
      }
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (isReady) {
      load();
    }
  }, [isReady, load]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    patientService
      .getSavedClinics()
      .then((response: any) => setSaved((response.data.data as any[]).some((item) => Number(item.id) === Number(id))))
      .catch(() => undefined);
  }, [isAuthenticated, id]);

  const toggleSaved = async () => {
    const next = !saved;
    setSaved(next);
    try {
      await (next ? patientService.saveClinic(id) : patientService.unsaveClinic(id));
    } catch {
      setSaved(!next);
      Alert.alert('Not saved', 'This needs an internet connection. Please try again.');
    }
  };

  const openUrl = (url: string) =>
    Linking.openURL(url).catch(() => Alert.alert('Maps unavailable', 'No maps app could be opened on this device.'));

  const promptSignInToSave = () =>
    Alert.alert('Sign in to save', 'Log in to keep this clinic in your saved clinics.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Log In', onPress: () => navigation.navigate('Login') },
    ]);

  if (loading) {
    return (
      <GuestShell navigation={navigation} patientTitle="Clinic Details">
        <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />
      </GuestShell>
    );
  }

  if (!clinic) {
    return (
      <GuestShell navigation={navigation} patientTitle="Clinic Details">
        {refreshing ? (
          <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />
        ) : (
          <Message
            icon={isOnline ? 'alert-circle-outline' : 'cloud-offline-outline'}
            title={isOnline ? 'Clinic not found' : 'Not saved on this device'}
            body={isOnline ? 'This clinic may no longer be listed.' : 'Connect to the internet to view this clinic.'}
            actionLabel="Try again"
            onAction={load}
          />
        )}
      </GuestShell>
    );
  }

  // Only a clinic opened online before has these; the directory entry does not.
  const details = clinic as Partial<ClinicDetails> & ClinicSummary;
  const hasDetails = details.services !== undefined;
  const dentists = details.dentists ?? [];
  const services = details.services ?? [];
  const branches = details.branches ?? [];
  const mainBranch = branches.find((branch) => branch.isMain) ?? branches[0];
  const otherBranches = branches.filter((branch) => branch !== mainBranch);
  const hours = mainBranch ? branchHours(mainBranch) : '';
  const dailyHours =
    clinic.openingTime && clinic.closingTime ? `Daily ${formatClock(clinic.openingTime)} – ${formatClock(clinic.closingTime)}` : '';
  const coordinates = clinic.latitude !== null && clinic.longitude !== null ? `${clinic.latitude},${clinic.longitude}` : null;
  const destination = encodeURIComponent(coordinates ?? `${clinic.name}, ${clinic.fullAddress}`);

  const notLoadedYet = refreshing ? (
    <ActivityIndicator style={styles.tabLoader} size="large" color={guestColors.primary} />
  ) : (
    <Message
      icon={isOnline ? 'alert-circle-outline' : 'cloud-offline-outline'}
      title={isOnline ? 'Could not load this' : 'Not saved on this device'}
      body={isOnline ? 'Please try again.' : 'Open this clinic once while online to keep this list on your device.'}
      actionLabel="Try again"
      onAction={load}
    />
  );

  const renderDentist = (dentist: ClinicDentist) => (
    <Card key={dentist.id} style={styles.dentistCard}>
      <Avatar name={dentist.name} color={accentFor(dentist.id)} size={48} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{dentist.name}</Text>
        <Text style={styles.rowText}>{dentist.specialization ?? 'General Dentistry'}</Text>
        {dentist.rating !== null ? (
          <View style={styles.ratingRow}>
            <Stars rating={dentist.rating} size={14} />
            <Text style={styles.rowText}>
              {dentist.rating.toFixed(1)} ({reviewsLabel(dentist.reviewCount)})
            </Text>
          </View>
        ) : (
          <Text style={styles.rowText}>No reviews yet</Text>
        )}
        <Text style={[styles.status, dentist.isAvailable ? styles.statusOn : styles.statusOff]}>
          {dentist.isAvailable ? 'Available' : 'Unavailable'}
        </Text>
        <TouchableOpacity
          style={styles.inlineLink}
          onPress={() => navigation.navigate('GuestDentistProfile', { id: dentist.id })}
          accessibilityRole="link"
          accessibilityLabel={`View profile of ${dentist.name}`}
        >
          <Text style={styles.linkText}>View Profile</Text>
          <Icon name="arrow-forward" size={14} color={guestColors.primary} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  const renderService = (service: ClinicService) => (
    <Card key={service.id}>
      <Text style={styles.rowTitle}>{service.name}</Text>
      {service.description ? <Text style={styles.rowText}>{service.description}</Text> : null}
      <View style={styles.serviceFooter}>
        <Text style={styles.price}>{formatPrice(service.price, service.currency)}</Text>
        <Text style={styles.rowText}>{service.durationMinutes} min</Text>
      </View>
    </Card>
  );

  const renderReview = (review: ClinicReview) => (
    <Card key={review.id}>
      <View style={styles.reviewAuthor}>
        <Avatar name={review.patientName} color={accentFor(review.id)} />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>{review.patientName}</Text>
          <Text style={styles.rowText}>Verified visit{review.date ? ` · ${review.date}` : ''}</Text>
        </View>
      </View>
      <Stars rating={review.rating} size={15} />
      {review.comment ? <Text style={styles.reviewText}>{review.comment}</Text> : null}
    </Card>
  );

  return (
    <GuestShell navigation={navigation} patientTitle="Clinic Details">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { backgroundColor: accentFor(clinic.id) }]}>
          {clinic.isVerified && (
            <View style={styles.verified}>
              <Icon name="shield-checkmark-outline" size={13} color={guestColors.successText} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
          <Text style={styles.heroName} accessibilityRole="header">
            {clinic.name}
          </Text>
          <View style={styles.heroAddress}>
            <Icon name="location-outline" size={16} color="rgba(255,255,255,0.85)" />
            <Text style={styles.heroAddressText}>{clinic.fullAddress}</Text>
          </View>
        </View>

        <View style={styles.bar}>
          <View style={styles.ratingRow}>
            <Stars rating={clinic.rating} />
            <Text style={styles.ratingText}>
              {clinic.rating.toFixed(1)} ({reviewsLabel(clinic.reviewCount)})
            </Text>
            {refreshing && <ActivityIndicator size="small" color={guestColors.primary} />}
          </View>
          <View style={styles.barActions}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={isAuthenticated ? toggleSaved : promptSignInToSave}
              accessibilityRole="button"
              accessibilityLabel={isAuthenticated ? `${saved ? 'Remove' : 'Save'} ${clinic.name}` : `Sign in to save ${clinic.name}`}
            >
              <Icon name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? '#f25c5c' : guestColors.text} />
            </TouchableOpacity>
            <PrimaryButton label="Book Appointment" onPress={() => book(clinic.id)} style={styles.flex} />
          </View>
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map(({ key, label }) => {
            const active = key === tab;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.panel}>
          {tab === 'overview' && (
            <>
              <Card>
                <CardTitle>Clinic Information</CardTitle>
                {clinic.description ? <Text style={styles.description}>{clinic.description}</Text> : null}
                <View style={styles.infoList}>
                  <InfoRow icon="location-outline" label="Address" value={clinic.fullAddress} />
                  {hours || dailyHours ? <InfoRow icon="time-outline" label="Operating Hours" value={hours || dailyHours} /> : null}
                  {clinic.contactNumber ? <InfoRow icon="call-outline" label="Phone" value={clinic.contactNumber} /> : null}
                  {clinic.email ? <InfoRow icon="mail-outline" label="Email" value={clinic.email} /> : null}
                </View>
              </Card>

              {branches.length > 0 && (
                <Card>
                  <CardTitle>Branches</CardTitle>
                  <View style={styles.infoList}>
                    {mainBranch && (
                      <InfoRow
                        icon="business-outline"
                        label="Main Branch"
                        value={[mainBranch.address, branchHours(mainBranch)].filter(Boolean).join(' · ')}
                      />
                    )}
                    {otherBranches.map((branch) => (
                      <InfoRow
                        key={branch.id}
                        icon="business-outline"
                        label={branch.name}
                        value={[branch.address, branchHours(branch)].filter(Boolean).join(' · ')}
                      />
                    ))}
                  </View>
                </Card>
              )}

              {/* TEMPORARY placeholders until clinics can upload gallery photos. */}
              <Card>
                <CardTitle>Gallery</CardTitle>
                <View style={styles.gallery}>
                  {GALLERY_OPACITY.map((opacity) => (
                    <View key={opacity} style={[styles.galleryTile, { backgroundColor: accentFor(clinic.id), opacity }]}>
                      <Icon name="business-outline" size={24} color="#ffffff" />
                    </View>
                  ))}
                </View>
              </Card>

              <Card>
                <CardTitle>Location</CardTitle>
                <View style={styles.mapPlaceholder}>
                  <Icon name="map-outline" size={36} color={guestColors.textMuted} />
                </View>
                <Text style={styles.rowText}>{clinic.fullAddress}</Text>
                <View style={styles.mapLinks}>
                  <TouchableOpacity
                    style={styles.inlineLink}
                    onPress={() => openUrl(`https://www.google.com/maps/dir/?api=1&destination=${destination}`)}
                    accessibilityRole="link"
                  >
                    <Text style={styles.linkText}>Get Directions</Text>
                    <Icon name="arrow-forward" size={14} color={guestColors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.inlineLink}
                    onPress={() => openUrl(`https://www.google.com/maps/search/?api=1&query=${destination}`)}
                    accessibilityRole="link"
                  >
                    <Text style={styles.linkText}>Open in Maps</Text>
                    <Icon name="arrow-forward" size={14} color={guestColors.primary} />
                  </TouchableOpacity>
                </View>
              </Card>

              <Card>
                <CardTitle>Quick Book</CardTitle>
                <Text style={styles.description}>Ready to book your appointment at {clinic.name}?</Text>
                <PrimaryButton label="Book Now" onPress={() => book(clinic.id)} />
              </Card>
            </>
          )}

          {tab === 'dentists' &&
            (!hasDetails ? notLoadedYet : dentists.length > 0 ? dentists.map(renderDentist) : (
              <Message icon="people-outline" title="No dentists listed yet" />
            ))}

          {tab === 'services' &&
            (!hasDetails ? notLoadedYet : services.length > 0 ? services.map(renderService) : (
              <Message icon="medical-outline" title="No services listed yet" />
            ))}

          {tab === 'reviews' &&
            (reviews === null ? notLoadedYet : reviews.length > 0 ? reviews.map(renderReview) : (
              <Message icon="chatbubble-outline" title="No reviews yet" body="Reviews come from patients after a completed visit." />
            ))}

          {savedAt && !isOnline ? <Text style={styles.savedNote}>Saved on this device {timeAgo(savedAt)}.</Text> : null}
        </View>

        <GuestFooter navigation={navigation} />
      </ScrollView>
    </GuestShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 64 },
  tabLoader: { marginVertical: spacing.xl },

  hero: { paddingHorizontal: spacing.marginMobile, paddingTop: spacing.xl + spacing.md, paddingBottom: spacing.lg, alignItems: 'flex-start' },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: guestColors.successSoft,
    marginBottom: spacing.sm,
  },
  verifiedText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: guestColors.successText },
  heroName: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: '#ffffff' },
  heroAddress: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.base },
  heroAddressText: { ...type.bodyMd, flex: 1, color: 'rgba(255,255,255,0.9)' },

  bar: { paddingHorizontal: spacing.marginMobile, paddingVertical: spacing.lg, gap: spacing.md },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, flexWrap: 'wrap' },
  ratingText: { fontSize: 15, lineHeight: 20, color: guestColors.text },
  barActions: { flexDirection: 'row', gap: spacing.sm },
  saveButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: guestColors.border,
    backgroundColor: guestColors.surface,
  },

  tabs: { flexDirection: 'row', marginHorizontal: spacing.marginMobile, borderBottomWidth: 1, borderBottomColor: guestColors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: guestColors.primary },
  tabText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: guestColors.text },
  tabTextActive: { color: guestColors.primary },

  panel: { padding: spacing.marginMobile, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },

  description: { ...type.bodyMd, color: guestColors.textMuted, marginBottom: spacing.md },
  infoList: { gap: spacing.md },
  infoRow: { flexDirection: 'row', gap: spacing.sm },
  infoLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4, color: guestColors.textMuted },
  infoValue: { ...type.bodyMd, color: guestColors.text },

  gallery: { flexDirection: 'row', gap: spacing.sm },
  galleryTile: { flex: 1, aspectRatio: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mapPlaceholder: {
    height: 150,
    borderRadius: 12,
    backgroundColor: guestColors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  mapLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md },

  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.base },
  linkText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.primary },

  dentistCard: { flexDirection: 'row', gap: spacing.md },
  rowTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: guestColors.text },
  rowText: { ...type.bodyMd, color: guestColors.textMuted },
  status: {
    alignSelf: 'flex-start',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.xs,
  },
  statusOn: { color: guestColors.successText, backgroundColor: guestColors.successSoft, borderColor: guestColors.successBorder },
  statusOff: { color: guestColors.textMuted, backgroundColor: guestColors.neutralSoft, borderColor: guestColors.border },

  serviceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  price: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: guestColors.primary },

  reviewAuthor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  reviewText: { ...type.bodyMd, color: guestColors.text, marginTop: spacing.sm },

  savedNote: { ...type.bodyMd, fontSize: 12, color: guestColors.textMuted, textAlign: 'center' },
});

export default GuestClinicDetailsScreen;
