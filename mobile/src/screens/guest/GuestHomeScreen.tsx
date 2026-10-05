// Guest landing page — the first screen for anyone without an active session.
// Everything renders from the on-device database, so it works offline; SyncContext
// refreshes that data whenever the server is reachable.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSync } from '../../context/SyncContext';
import OfflineBanner from '../../components/common/OfflineBanner';
import ClinicImage from '../../components/guest/ClinicImage';
import GuestDrawer, { GuestMenuKey } from '../../components/guest/GuestDrawer';
import SelectSheet from '../../components/guest/SelectSheet';
import { specializationStyle } from '../../components/guest/specializationStyle';
import {
  ClinicReview,
  ClinicSummary,
  getCachedHome,
  getCities,
  getSpecializations,
  HomeData,
  ServiceRateSummary,
  Specialization,
} from '../../services/offline/publicRepository';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';
import { formatPrice } from '../../utils/format';

type SectionKey = 'services' | 'rates' | 'about';

const WHY_US = [
  {
    icon: 'shield-checkmark-outline',
    title: 'Verified Clinics',
    body: 'Every clinic is manually verified for proper licensing and health standards.',
    background: palette.primaryFixed,
    color: palette.primary,
  },
  {
    icon: 'calendar-outline',
    title: 'Easy Booking',
    body: 'Book your appointment in seconds without making a single phone call.',
    background: palette.secondaryContainer,
    color: palette.onSecondaryContainer,
  },
  {
    icon: 'cash-outline',
    title: 'Price Transparency',
    body: 'View and compare service rates across different clinics before you visit.',
    background: palette.tertiaryFixed,
    color: palette.onTertiaryFixed,
  },
];

const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=dental+clinic+Bukidnon';

const HorizontalGap = () => <View style={styles.horizontalGap} />;

const GuestHomeScreen = ({ navigation }: { navigation: any }) => {
  const { width } = useWindowDimensions();
  const { isReady, isOnline, isSyncing, dataVersion, syncNow } = useSync();

  const [home, setHome] = useState<HomeData | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [activeMenu, setActiveMenu] = useState<GuestMenuKey>('home');

  const [searchName, setSearchName] = useState('');
  const [searchCity, setSearchCity] = useState<string | null>(null);
  const [searchSpecialization, setSearchSpecialization] = useState<number | null>(null);
  const [picker, setPicker] = useState<'city' | 'specialization' | null>(null);

  const [reviewIndex, setReviewIndex] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Partial<Record<SectionKey, number>>>({});

  const featuredCardWidth = Math.max(280, Math.min(width * 0.78, 340));
  const reviewCardWidth = width - spacing.marginMobile * 2;

  const loadLocalData = useCallback(async () => {
    try {
      const [cachedHome, cityList, specializationList] = await Promise.all([
        getCachedHome(),
        getCities(),
        getSpecializations(),
      ]);
      setHome(cachedHome?.value ?? null);
      setCities(cityList);
      setSpecializations(specializationList);
    } catch (error) {
      console.error('Failed to read saved home data:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Re-read the local copy on start-up and after every sync.
  useEffect(() => {
    if (isReady) {
      loadLocalData();
    }
  }, [isReady, dataVersion, loadLocalData]);

  const onRefresh = async () => {
    setRefreshing(true);
    const synced = await syncNow();
    setRefreshing(false);
    if (!synced) {
      Alert.alert("You're offline", 'Showing the clinics saved on this device. We will update them once you reconnect.');
    }
  };

  const goToClinics = (params: Record<string, unknown> = {}) => navigation.navigate('GuestClinics', params);
  const goToClinic = (clinic: ClinicSummary) => navigation.navigate('GuestClinicDetails', { id: clinic.id });

  const scrollToSection = (key: SectionKey) => {
    const y = sectionOffsets.current[key];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.base), animated: true });
    }
  };

  const recordSection = (key: SectionKey) => (event: { nativeEvent: { layout: { y: number } } }) => {
    sectionOffsets.current[key] = event.nativeEvent.layout.y;
  };

  const handleMenuSelect = (key: GuestMenuKey) => {
    if (key === 'clinics') {
      goToClinics();
      return;
    }
    setActiveMenu(key);
    if (key === 'home') {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      scrollToSection(key);
    }
  };

  const handleQuickSearch = () => {
    goToClinics({
      search: searchName.trim(),
      city: searchCity,
      specializationId: searchSpecialization,
    });
  };

  const showRateDetails = (rate: ServiceRateSummary) => {
    const service = home?.popularServices.find(
      (item) => item.name.toLowerCase() === rate.serviceName.toLowerCase(),
    );
    const clinics = `${rate.clinicCount} verified clinic${rate.clinicCount === 1 ? '' : 's'}`;
    Alert.alert(
      rate.serviceName,
      `${service?.description ? `${service.description}\n\n` : ''}Starts at ${formatPrice(
        rate.startingPrice,
        rate.currency,
      )} across ${clinics}. The final cost depends on the clinic and your dentist's assessment.`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Find Clinics', onPress: () => goToClinics() },
      ],
    );
  };

  const onReviewScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (reviewCardWidth + spacing.md));
    setReviewIndex(index);
  };

  const cityOptions = useMemo(
    () => [{ label: 'All locations', value: null as string | null }, ...cities.map((city) => ({ label: city, value: city as string | null }))],
    [cities],
  );
  const specializationOptions = useMemo(
    () => [
      { label: 'All specializations', value: null as number | null },
      ...specializations.map((spec) => ({ label: spec.name, value: spec.id as number | null })),
    ],
    [specializations],
  );
  const selectedSpecializationName =
    specializations.find((spec) => spec.id === searchSpecialization)?.name ?? 'All specializations';

  const stats = home?.stats;
  const featured = home?.featuredClinics ?? [];
  const reviews = home?.recentReviews ?? [];
  const rates = home?.serviceRates ?? [];
  const hasNoData = loaded && !home && cities.length === 0;

  // ---------------------------------------------------------------------------
  // Sections
  // ---------------------------------------------------------------------------

  const renderFeaturedCard = ({ item }: { item: ClinicSummary }) => (
    <TouchableOpacity
      style={[styles.featuredCard, { width: featuredCardWidth }]}
      onPress={() => goToClinic(item)}
      activeOpacity={0.9}
    >
      <ClinicImage uri={item.image} name={item.name} style={styles.featuredImage} />
      <View style={styles.featuredBody}>
        <View style={styles.featuredTitleRow}>
          <Text style={styles.featuredName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.ratingInline}>
            <Icon name="star" size={14} color={palette.secondary} />
            <Text style={styles.ratingInlineText}>{item.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.featuredCity} numberOfLines={1}>
          {item.fullAddress || item.city}
        </Text>
        <View style={styles.outlineButtonSmall}>
          <Text style={styles.outlineButtonSmallText}>View Details</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderReview = ({ item }: { item: ClinicReview }) => (
    <View style={[styles.reviewCard, { width: reviewCardWidth }]}>
      <Icon name="chatbubble-ellipses-outline" size={56} color={palette.primaryFixed} style={styles.reviewQuote} />
      <View style={styles.reviewStars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Icon
            key={star}
            name={star <= item.rating ? 'star' : 'star-outline'}
            size={18}
            color={palette.secondary}
          />
        ))}
      </View>
      <Text style={styles.reviewText}>"{item.comment}"</Text>
      <View style={styles.reviewAuthor}>
        <View style={styles.reviewAvatar}>
          <Text style={styles.reviewAvatarText}>{item.patientName.charAt(0)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.reviewName}>{item.patientName}</Text>
          <Text style={styles.reviewMeta} numberOfLines={1}>
            Verified Patient{item.clinicName ? ` · ${item.clinicName}` : ''}
            {item.date ? ` · ${item.date}` : ''}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyCard}>
      <Icon name="cloud-offline-outline" size={36} color={palette.outline} />
      <Text style={styles.emptyTitle}>No clinic data on this device yet</Text>
      <Text style={styles.emptyBody}>
        Connect to the internet once to download the clinic directory. After that, you can browse clinics even
        while offline.
      </Text>
      <TouchableOpacity style={styles.primaryButtonCompact} onPress={onRefresh} disabled={isSyncing}>
        {isSyncing ? (
          <ActivityIndicator size="small" color={palette.onPrimary} />
        ) : (
          <Text style={styles.primaryButtonText}>Try again</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.surfaceContainerLowest} />

      {/* Top app bar */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>BukidnonDental</Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setDrawerVisible(true)}
          accessibilityLabel="Open menu"
        >
          <Icon name="menu" size={26} color={palette.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
      <OfflineBanner />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[palette.primary]}
            tintColor={palette.primary}
          />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.blob, styles.blobTop]} />
          <View style={[styles.blob, styles.blobBottom]} />
          <View style={styles.heroBadge}>
            <Icon name="shield-checkmark" size={14} color={palette.onPrimaryFixedVariant} />
            <Text style={styles.heroBadgeText}>
              {stats?.verifiedClinics
                ? `${stats.verifiedClinics} Verified Clinic${stats.verifiedClinics === 1 ? '' : 's'}`
                : 'Verified Clinics Only'}
            </Text>
          </View>
          <Text style={styles.heroTitle}>{home?.meta.title ?? 'Find Trusted Dental Clinics Across Bukidnon'}</Text>
          <Text style={styles.heroSubtitle}>
            Search, compare, and book dental appointments online with the province's leading dental network.
          </Text>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroPrimary} onPress={() => goToClinics()} activeOpacity={0.85}>
              <Icon name="search" size={20} color={palette.onPrimary} />
              <Text style={styles.primaryButtonText}>Find Clinics</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroSecondary}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.85}
            >
              <Text style={styles.heroSecondaryText}>Register Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick search */}
        <View style={styles.quickSearchWrap}>
          <View style={styles.quickSearchCard}>
            <View style={styles.quickSearchHeader}>
              <Icon name="options-outline" size={22} color={palette.primary} />
              <Text style={styles.quickSearchTitle}>Quick Search</Text>
            </View>

            <Text style={styles.fieldLabel}>Clinic Name or Area</Text>
            <View style={styles.field}>
              <Icon name="business-outline" size={20} color={palette.outline} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Search name..."
                placeholderTextColor={palette.outline}
                value={searchName}
                onChangeText={setSearchName}
                returnKeyType="search"
                onSubmitEditing={handleQuickSearch}
              />
            </View>

            <Text style={styles.fieldLabel}>Location</Text>
            <TouchableOpacity style={styles.field} onPress={() => setPicker('city')}>
              <Icon name="location-outline" size={20} color={palette.outline} />
              <Text style={styles.fieldValue} numberOfLines={1}>
                {searchCity ?? 'All locations'}
              </Text>
              <Icon name="chevron-down" size={18} color={palette.outline} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Specialization</Text>
            <TouchableOpacity style={styles.field} onPress={() => setPicker('specialization')}>
              <Icon name="medical-outline" size={20} color={palette.outline} />
              <Text style={styles.fieldValue} numberOfLines={1}>
                {selectedSpecializationName}
              </Text>
              <Icon name="chevron-down" size={18} color={palette.outline} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.searchButton} onPress={handleQuickSearch} activeOpacity={0.85}>
              <Icon name="search" size={18} color={palette.onPrimary} />
              <Text style={styles.primaryButtonText}>Search Clinics</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!loaded || (isSyncing && !home) ? (
          <ActivityIndicator style={styles.sectionLoader} size="large" color={palette.primary} />
        ) : hasNoData ? (
          renderEmptyState()
        ) : (
          <>
            {/* Featured clinics */}
            {featured.length > 0 && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.flex}>
                    <Text style={styles.sectionTitle}>Featured Clinics</Text>
                    <Text style={styles.sectionSubtitle}>Top-rated dental centers</Text>
                  </View>
                  <TouchableOpacity onPress={() => goToClinics()} hitSlop={8}>
                    <Text style={styles.link}>View all</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  horizontal
                  data={featured}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderFeaturedCard}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  ItemSeparatorComponent={HorizontalGap}
                  snapToInterval={featuredCardWidth + spacing.md}
                  decelerationRate="fast"
                />
              </View>
            )}

            {/* Specializations */}
            {specializations.length > 0 && (
              <View style={styles.sectionPadded} onLayout={recordSection('services')}>
                <Text style={[styles.sectionTitle, styles.sectionTitleSpacing]}>Popular Services</Text>
                <View style={styles.grid}>
                  {specializations.slice(0, 4).map((spec, index) => {
                    const { icon, color } = specializationStyle(spec.name, index);
                    return (
                      <TouchableOpacity
                        key={spec.id}
                        style={styles.serviceTile}
                        onPress={() => goToClinics({ specializationId: spec.id })}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.serviceIcon, { backgroundColor: `${color}1A` }]}>
                          <Icon name={icon} size={26} color={color} />
                        </View>
                        <Text style={styles.serviceLabel} numberOfLines={2}>
                          {spec.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Service rates */}
            {rates.length > 0 && (
              <View style={styles.ratesSection} onLayout={recordSection('rates')}>
                <Text style={[styles.sectionTitle, styles.sectionTitleSpacing]}>Service Rates</Text>
                <View style={styles.ratesList}>
                  {rates.map((rate, index) => {
                    const accent = index % 2 === 0 ? palette.primary : palette.secondary;
                    return (
                      <View key={rate.serviceName} style={[styles.rateCard, { borderLeftColor: accent }]}>
                        <View style={styles.flex}>
                          <Text style={styles.rateName}>{rate.serviceName}</Text>
                          <Text style={styles.rateMeta}>
                            Starting price · {rate.clinicCount} clinic{rate.clinicCount === 1 ? '' : 's'}
                          </Text>
                        </View>
                        <View style={styles.rateRight}>
                          <Text style={[styles.ratePrice, { color: accent }]}>
                            {formatPrice(rate.startingPrice, rate.currency)}
                          </Text>
                          <TouchableOpacity onPress={() => showRateDetails(rate)} hitSlop={8}>
                            <Text style={[styles.rateLink, { color: accent }]}>Learn More</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        {/* Why choose us (static, always available) */}
        <View style={styles.sectionPadded} onLayout={recordSection('about')}>
          <Text style={[styles.sectionTitle, styles.whyTitle]}>Why BukidnonDental?</Text>
          <View style={styles.whyList}>
            {WHY_US.map((item) => (
              <View key={item.title} style={styles.whyItem}>
                <View style={[styles.whyIcon, { backgroundColor: item.background }]}>
                  <Icon name={item.icon} size={24} color={item.color} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.whyItemTitle}>{item.title}</Text>
                  <Text style={styles.whyItemBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Map preview */}
        <View style={styles.mapPreview}>
          <Icon name="map-outline" size={48} color={palette.outline} />
          <Text style={styles.mapLabel}>Interactive Map of Clinics</Text>
          {cities.length > 0 && (
            <Text style={styles.mapCities} numberOfLines={2}>
              {cities.join(' · ')}
            </Text>
          )}
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() =>
              Linking.openURL(MAPS_URL).catch(() =>
                Alert.alert('Maps unavailable', 'No maps app could be opened on this device.'),
              )
            }
            activeOpacity={0.85}
          >
            <Icon name="open-outline" size={18} color={palette.onPrimary} />
            <Text style={styles.primaryButtonText}>Open Full Map</Text>
          </TouchableOpacity>
          {!isOnline && <Text style={styles.mapHint}>Maps need a connection unless downloaded offline.</Text>}
        </View>

        {/* Patient stories */}
        {reviews.length > 0 && (
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, styles.sectionTitleSpacing, styles.sectionPaddedTitle]}>
              Patient Stories
            </Text>
            <FlatList
              horizontal
              data={reviews}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderReview}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={HorizontalGap}
              snapToInterval={reviewCardWidth + spacing.md}
              decelerationRate="fast"
              onMomentumScrollEnd={onReviewScroll}
            />
            <View style={styles.dots}>
              {reviews.map((review, index) => (
                <View key={review.id} style={[styles.dot, index === reviewIndex && styles.dotActive]} />
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>BukidnonDental</Text>
          <Text style={styles.footerText}>
            The leading digital gateway to quality dental care in the heart of Bukidnon.
          </Text>
          <View style={styles.footerColumns}>
            <View style={styles.footerColumn}>
              <Text style={styles.footerHeading}>EXPLORE</Text>
              <Text style={styles.footerLink} onPress={() => goToClinics()}>
                Find Clinics
              </Text>
              <Text style={styles.footerLink} onPress={() => scrollToSection('services')}>
                Services
              </Text>
              <Text style={styles.footerLink} onPress={() => scrollToSection('rates')}>
                Service Rates
              </Text>
            </View>
            <View style={styles.footerColumn}>
              <Text style={styles.footerHeading}>ACCOUNT</Text>
              <Text style={styles.footerLink} onPress={() => navigation.navigate('Login')}>
                Log In
              </Text>
              <Text style={styles.footerLink} onPress={() => navigation.navigate('Register')}>
                Register
              </Text>
              <Text
                style={styles.footerLink}
                onPress={() => navigation.navigate('Register', { role: 'clinic_admin' })}
              >
                List Your Clinic
              </Text>
            </View>
          </View>
          <View style={styles.footerBottom}>
            <Text style={styles.footerCopyright}>
              © {new Date().getFullYear()} BukidnonDental. All rights reserved.
            </Text>
          </View>
        </View>
      </ScrollView>

      <GuestDrawer
        visible={drawerVisible}
        activeItem={activeMenu}
        onClose={() => setDrawerVisible(false)}
        onSelect={handleMenuSelect}
        onLogin={() => navigation.navigate('Login')}
        onRegister={() => navigation.navigate('Register')}
      />

      <SelectSheet
        visible={picker === 'city'}
        title="Location"
        options={cityOptions}
        selected={searchCity}
        onSelect={setSearchCity}
        onClose={() => setPicker(null)}
      />
      <SelectSheet
        visible={picker === 'specialization'}
        title="Specialization"
        options={specializationOptions}
        selected={searchSpecialization}
        onSelect={setSearchSpecialization}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    paddingVertical: spacing.sm,
    backgroundColor: palette.surfaceContainerLowest,
    ...shadow.sm,
    zIndex: 2,
  },
  brand: { ...type.headlineMd, fontWeight: '700', color: palette.primary },
  iconButton: { padding: spacing.base, borderRadius: radius.full },

  hero: {
    paddingHorizontal: spacing.marginMobile,
    paddingTop: 48,
    paddingBottom: 80,
    alignItems: 'center',
    overflow: 'hidden',
  },
  blob: { position: 'absolute', width: 256, height: 256, borderRadius: 128 },
  blobTop: { top: -40, left: -80, backgroundColor: palette.primaryFixed, opacity: 0.5 },
  blobBottom: { bottom: -40, right: -80, backgroundColor: palette.secondaryContainer, opacity: 0.25 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: palette.primaryFixed,
    marginBottom: spacing.md,
  },
  heroBadgeText: { ...type.labelMd, color: palette.onPrimaryFixedVariant },
  heroTitle: { ...type.headlineLgMobile, color: palette.onSurface, textAlign: 'center', marginBottom: spacing.md },
  heroSubtitle: {
    ...type.bodyLg,
    color: palette.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 384,
    marginBottom: spacing.xl,
  },
  heroActions: { width: '100%', gap: spacing.sm },
  heroPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.primary,
    ...shadow.lg,
  },
  heroSecondary: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceContainerHighest,
  },
  heroSecondaryText: { ...type.labelMd, fontSize: 14, color: palette.onSurface },
  primaryButtonText: { ...type.labelMd, fontSize: 14, color: palette.onPrimary },

  quickSearchWrap: { paddingHorizontal: spacing.marginMobile, marginTop: -40, marginBottom: 48 },
  quickSearchCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(222,226,230,0.6)',
    padding: spacing.lg,
    ...shadow.lg,
  },
  quickSearchHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, marginBottom: spacing.md },
  quickSearchTitle: { ...type.titleLg, color: palette.onSurface },
  fieldLabel: {
    ...type.labelMd,
    color: palette.onSurfaceVariant,
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    backgroundColor: palette.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  fieldInput: { ...type.bodyMd, flex: 1, color: palette.onSurface, paddingVertical: spacing.sm },
  fieldValue: { ...type.bodyMd, flex: 1, color: palette.onSurface },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: palette.primary,
    marginTop: spacing.xs,
  },

  sectionLoader: { marginVertical: 48 },
  sectionBlock: { marginBottom: 48 },
  sectionPadded: { paddingHorizontal: spacing.marginMobile, marginBottom: 48 },
  sectionPaddedTitle: { paddingHorizontal: spacing.marginMobile },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.marginMobile,
    marginBottom: spacing.lg,
  },
  sectionTitle: { ...type.headlineMd, color: palette.onSurface },
  sectionTitleSpacing: { marginBottom: spacing.lg },
  sectionSubtitle: { ...type.bodyMd, color: palette.onSurfaceVariant },
  link: { ...type.labelMd, color: palette.primary },
  horizontalList: { paddingHorizontal: spacing.marginMobile },
  horizontalGap: { width: spacing.md },

  featuredCard: {
    backgroundColor: palette.surfaceContainerLowest,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(194,198,212,0.3)',
    ...shadow.sm,
  },
  featuredImage: { width: '100%', height: 160 },
  featuredBody: { padding: spacing.md },
  featuredTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.base,
    marginBottom: spacing.xs,
  },
  featuredName: { ...type.titleLg, color: palette.onSurface, flex: 1 },
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 4 },
  ratingInlineText: { ...type.labelMd, color: palette.secondary },
  featuredCity: { ...type.bodyMd, color: palette.onSurfaceVariant, marginBottom: spacing.md },
  outlineButtonSmall: {
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.primary,
    alignItems: 'center',
  },
  outlineButtonSmallText: { ...type.labelMd, color: palette.primary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  serviceTile: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceContainerLow,
    borderWidth: 1,
    borderColor: 'rgba(194,198,212,0.2)',
  },
  serviceIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  serviceLabel: { ...type.labelMd, color: palette.onSurface, textAlign: 'center' },

  ratesSection: {
    backgroundColor: palette.surfaceContainerHigh,
    paddingVertical: 48,
    paddingHorizontal: spacing.marginMobile,
    marginBottom: 48,
  },
  ratesList: { gap: spacing.md },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceContainerLowest,
    borderLeftWidth: 4,
    ...shadow.sm,
  },
  rateName: { ...type.titleLg, fontSize: 18, color: palette.onSurface },
  rateMeta: { ...type.bodyMd, color: palette.onSurfaceVariant },
  rateRight: { alignItems: 'flex-end', gap: spacing.xs },
  ratePrice: { ...type.headlineMd, fontSize: 22 },
  rateLink: { ...type.labelMd },

  whyTitle: { marginBottom: spacing.xl },
  whyList: { gap: spacing.xl },
  whyItem: { flexDirection: 'row', gap: spacing.md },
  whyIcon: { width: 48, height: 48, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  whyItemTitle: { ...type.titleLg, color: palette.onSurface, marginBottom: spacing.xs },
  whyItemBody: { ...type.bodyMd, color: palette.onSurfaceVariant },

  mapPreview: {
    height: 256,
    marginBottom: 48,
    backgroundColor: palette.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.marginMobile,
    gap: spacing.base,
  },
  mapLabel: { ...type.labelMd, color: palette.onSurfaceVariant },
  mapCities: { ...type.bodyMd, color: palette.onSurfaceVariant, textAlign: 'center' },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: palette.primary,
    marginTop: spacing.sm,
    ...shadow.lg,
  },
  mapHint: { ...type.bodyMd, fontSize: 12, color: palette.outline },

  reviewCard: {
    backgroundColor: palette.surfaceContainerLowest,
    padding: spacing.lg,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(194,198,212,0.3)',
    ...shadow.sm,
  },
  reviewQuote: { position: 'absolute', top: spacing.md, right: spacing.md },
  reviewStars: { flexDirection: 'row', gap: 2, marginBottom: spacing.md },
  reviewText: {
    ...type.bodyLg,
    fontStyle: 'italic',
    color: palette.onSurfaceVariant,
    marginBottom: spacing.lg,
  },
  reviewAuthor: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primaryFixedDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { ...type.titleLg, fontSize: 16, color: palette.primary },
  reviewName: { ...type.titleLg, fontSize: 16, color: palette.onSurface },
  reviewMeta: { ...type.labelMd, color: palette.onSurfaceVariant, letterSpacing: 0.2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.base, marginTop: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.outlineVariant },
  dotActive: { backgroundColor: palette.primary },

  emptyCard: {
    marginHorizontal: spacing.marginMobile,
    marginBottom: 48,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceContainerLow,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: { ...type.titleLg, fontSize: 18, color: palette.onSurface, textAlign: 'center' },
  emptyBody: { ...type.bodyMd, color: palette.onSurfaceVariant, textAlign: 'center' },
  primaryButtonCompact: {
    minWidth: 140,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.primary,
    marginTop: spacing.xs,
  },

  footer: {
    backgroundColor: palette.surfaceContainer,
    padding: spacing.marginMobile,
    paddingTop: spacing.xl,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: palette.outlineVariant,
  },
  footerBrand: { ...type.headlineMd, fontWeight: '700', color: palette.onSurface, marginBottom: spacing.md },
  footerText: { ...type.bodyMd, color: palette.onSurfaceVariant, marginBottom: spacing.xl },
  footerColumns: { flexDirection: 'row', gap: spacing.xl },
  footerColumn: { flex: 1, gap: spacing.sm },
  footerHeading: { ...type.labelMd, color: palette.onSurface, letterSpacing: 1.2 },
  footerLink: { ...type.bodyMd, color: palette.onSurfaceVariant, paddingVertical: 2 },
  footerBottom: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(194,198,212,0.3)',
  },
  footerCopyright: { ...type.bodyMd, fontSize: 12, color: palette.onSurfaceVariant },
});

export default GuestHomeScreen;
