// Clinic details for guests. Shows the saved copy immediately, refreshes it (and its
// reviews) when online, and routes "Book" through login/registration.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSync } from '../../context/SyncContext';
import { isNetworkError } from '../../services/api';
import OfflineBanner from '../../components/common/OfflineBanner';
import ClinicImage from '../../components/guest/ClinicImage';
import {
  ClinicReview,
  ClinicSummary,
  fetchClinicDetails,
  getCachedClinicDetails,
} from '../../services/offline/publicRepository';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';
import { formatClock, getOpenStatus, timeAgo } from '../../utils/format';

const GuestClinicDetailsScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const id: number = route.params.id;
  const { isReady, isOnline } = useSync();

  const [clinic, setClinic] = useState<ClinicSummary | null>(null);
  const [reviews, setReviews] = useState<ClinicReview[] | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const openUrl = (url: string, failure: string) =>
    Linking.openURL(url).catch(() => Alert.alert('Not available', failure));

  const handleCall = () =>
    clinic?.contactNumber && openUrl(`tel:${clinic.contactNumber}`, 'Calling is not supported on this device.');
  const handleEmail = () =>
    clinic?.email && openUrl(`mailto:${clinic.email}`, 'No email app is set up on this device.');
  const handleDirections = () =>
    clinic &&
    openUrl(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${clinic.name}, ${clinic.fullAddress}`)}`,
      'No maps app could be opened on this device.',
    );

  const handleBook = () =>
    Alert.alert('Sign in to book', 'Create a free account or log in to book an appointment with this clinic.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Log In', onPress: () => navigation.navigate('Login') },
      { text: 'Register', onPress: () => navigation.navigate('Register') },
    ]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (!clinic) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityLabel="Back">
            <Icon name="arrow-back" size={24} color={palette.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          {refreshing ? (
            <ActivityIndicator size="large" color={palette.primary} />
          ) : (
            <>
              <Icon name={isOnline ? 'alert-circle-outline' : 'cloud-offline-outline'} size={40} color={palette.outline} />
              <Text style={styles.emptyTitle}>{isOnline ? 'Clinic not found' : 'Not saved on this device'}</Text>
              <Text style={styles.emptyBody}>
                {isOnline
                  ? 'This clinic may no longer be listed.'
                  : 'Connect to the internet to view this clinic.'}
              </Text>
              <TouchableOpacity style={styles.outlineButton} onPress={load}>
                <Text style={styles.outlineButtonText}>Try again</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const status = getOpenStatus(clinic.openingTime, clinic.closingTime);
  const opening = formatClock(clinic.openingTime);
  const closing = formatClock(clinic.closingTime);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.surfaceContainerLowest} />
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityLabel="Back">
            <Icon name="arrow-back" size={24} color={palette.primary} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            Clinic Details
          </Text>
        </View>
        {refreshing && <ActivityIndicator size="small" color={palette.primary} />}
      </View>
      <OfflineBanner />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ClinicImage uri={clinic.image} name={clinic.name} style={styles.hero} />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{clinic.name}</Text>
            {clinic.isVerified && (
              <View style={styles.verified}>
                <Icon name="checkmark-circle" size={14} color={palette.onSecondaryContainer} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <Icon name="star" size={16} color={palette.secondary} />
            <Text style={styles.metaStrong}>{clinic.rating.toFixed(1)}</Text>
            {reviews && (
              <Text style={styles.metaText}>
                · {reviews.length} recent review{reviews.length === 1 ? '' : 's'}
              </Text>
            )}
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Icon name="location-outline" size={20} color={palette.primary} />
              <Text style={styles.infoText}>{clinic.fullAddress}</Text>
            </View>
            {opening && closing && (
              <View style={styles.infoRow}>
                <Icon name="time-outline" size={20} color={palette.primary} />
                <Text style={styles.infoText}>
                  Daily {opening} – {closing}
                  {status ? (
                    <Text style={status.isOpen ? styles.openText : styles.closedText}>
                      {'  '}
                      {status.isOpen ? 'Open now' : 'Closed now'}
                    </Text>
                  ) : null}
                </Text>
              </View>
            )}
            {clinic.contactNumber && (
              <View style={styles.infoRow}>
                <Icon name="call-outline" size={20} color={palette.primary} />
                <Text style={styles.infoText}>{clinic.contactNumber}</Text>
              </View>
            )}
            {clinic.email && (
              <View style={styles.infoRow}>
                <Icon name="mail-outline" size={20} color={palette.primary} />
                <Text style={styles.infoText}>{clinic.email}</Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, !clinic.contactNumber && styles.actionDisabled]}
              onPress={handleCall}
              disabled={!clinic.contactNumber}
            >
              <Icon name="call-outline" size={20} color={palette.primary} />
              <Text style={styles.actionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, !clinic.email && styles.actionDisabled]}
              onPress={handleEmail}
              disabled={!clinic.email}
            >
              <Icon name="mail-outline" size={20} color={palette.primary} />
              <Text style={styles.actionText}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleDirections}>
              <Icon name="navigate-outline" size={20} color={palette.primary} />
              <Text style={styles.actionText}>Directions</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.paragraph}>{clinic.description ?? 'No description provided yet.'}</Text>

          {clinic.specializations.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Specializations</Text>
              <View style={styles.tags}>
                {clinic.specializations.map((spec) => (
                  <View key={spec.name} style={styles.tag}>
                    <Text style={styles.tagText}>{spec.name}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>Patient Reviews</Text>
          {reviews === null ? (
            <Text style={styles.mutedText}>
              {isOnline ? 'Loading reviews…' : 'Reviews will load the next time you are online.'}
            </Text>
          ) : reviews.length === 0 ? (
            <Text style={styles.mutedText}>No reviews yet.</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={styles.review}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewName}>{review.patientName}</Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Icon
                        key={star}
                        name={star <= review.rating ? 'star' : 'star-outline'}
                        size={14}
                        color={palette.secondary}
                      />
                    ))}
                  </View>
                </View>
                {review.comment ? <Text style={styles.paragraph}>{review.comment}</Text> : null}
                {review.date ? <Text style={styles.mutedText}>{review.date}</Text> : null}
              </View>
            ))
          )}

          {savedAt && !isOnline && <Text style={styles.savedNote}>Saved on this device {timeAgo(savedAt)}.</Text>}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bookButton} onPress={handleBook} activeOpacity={0.85}>
          <Icon name="calendar-outline" size={20} color={palette.onPrimary} />
          <Text style={styles.bookButtonText}>Book Appointment</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: palette.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.base,
    backgroundColor: palette.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: palette.outlineVariant,
    ...shadow.sm,
    zIndex: 2,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, flex: 1 },
  topBarTitle: { ...type.headlineMd, fontSize: 22, fontWeight: '700', color: palette.primary, flex: 1 },
  iconButton: { padding: spacing.base, borderRadius: radius.full },

  scrollContent: { paddingBottom: spacing.xl },
  hero: { width: '100%', height: 220 },
  body: { padding: spacing.marginMobile },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.base, marginBottom: spacing.xs },
  name: { ...type.headlineMd, color: palette.onSurface, flex: 1 },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.base,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: palette.secondaryContainer,
    marginTop: 6,
  },
  verifiedText: { ...type.labelMd, fontSize: 11, color: palette.onSecondaryContainer },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  metaStrong: { ...type.labelMd, fontSize: 14, color: palette.secondary },
  metaText: { ...type.bodyMd, color: palette.onSurfaceVariant },

  infoCard: {
    backgroundColor: palette.surfaceContainerLowest,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(194,198,212,0.5)',
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  infoText: { ...type.bodyMd, color: palette.onSurface, flex: 1 },
  openText: { color: palette.secondary, fontWeight: '600' },
  closedText: { color: palette.error, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.primaryFixed,
  },
  actionDisabled: { opacity: 0.4 },
  actionText: { ...type.labelMd, color: palette.primary },

  sectionTitle: { ...type.titleLg, color: palette.onSurface, marginTop: spacing.md, marginBottom: spacing.sm },
  paragraph: { ...type.bodyMd, color: palette.onSurfaceVariant },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: palette.tertiaryFixed,
  },
  tagText: { ...type.labelMd, color: palette.onTertiaryFixedVariant },
  mutedText: { ...type.bodyMd, fontSize: 12, color: palette.outline },
  review: {
    backgroundColor: palette.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(194,198,212,0.4)',
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewName: { ...type.labelMd, fontSize: 14, color: palette.onSurface },
  reviewStars: { flexDirection: 'row', gap: 1 },
  savedNote: { ...type.bodyMd, fontSize: 12, color: palette.outline, marginTop: spacing.lg, textAlign: 'center' },

  emptyTitle: { ...type.titleLg, fontSize: 18, color: palette.onSurface, textAlign: 'center' },
  emptyBody: { ...type.bodyMd, color: palette.onSurfaceVariant, textAlign: 'center' },
  outlineButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  outlineButtonText: { ...type.labelMd, color: palette.primary },

  bottomBar: {
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
    backgroundColor: palette.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: palette.outlineVariant,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.primary,
  },
  bookButtonText: { ...type.labelMd, fontSize: 14, color: palette.onPrimary },
});

export default GuestClinicDetailsScreen;
