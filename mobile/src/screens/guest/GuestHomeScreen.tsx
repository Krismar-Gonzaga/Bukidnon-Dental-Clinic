// Guest landing page — the first screen for anyone without an active session, laid out
// like the website's home page on a phone. Everything renders from the on-device database,
// so it works offline; SyncContext refreshes that data whenever the server is reachable.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSync } from '../../context/SyncContext';
import GuestClinicCard from '../../components/guest/GuestClinicCard';
import GuestShell, { GuestFooter } from '../../components/guest/GuestShell';
import {
  Avatar,
  Card,
  FieldLabel,
  guestColors,
  Message,
  OutlineButton,
  PrimaryButton,
  SearchField,
  SelectField,
  Stars,
} from '../../components/guest/GuestUi';
import SelectSheet from '../../components/guest/SelectSheet';
import { useCachedResource } from '../../components/guest/useCachedResource';
import { BRAND_NAME, SPECIALIZATION_CARDS, WHY_BOOK } from '../../content/guestContent';
import {
  ClinicSummary,
  fetchServiceCatalog,
  getCachedHome,
  getCachedServiceCatalog,
  getCities,
  getSpecializations,
  HomeData,
  queryClinics,
  Specialization,
} from '../../services/offline/publicRepository';
import { spacing, type } from '../../theme/tokens';
import { formatPriceRange } from '../../utils/format';

// Cropped from the design screenshot (494 × 462 px). Replace assets/home-hero-clinic.jpg
// with the original artwork when available.
const HERO_IMAGE = require('../../../assets/home-hero-clinic.jpg');

const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=dental+clinic+Bukidnon';

const HERO_IMAGE_RATIO = 1.07;
const SERVICES_SHOWN = 4;
const REVIEWS_SHOWN = 3;
const AVATAR_COLORS = ['#003f87', '#006c4f', '#3a434a'];

// Approximate bounding box of Bukidnon, the same one the website places its pins with.
const BOUNDS = { north: 8.75, south: 7.35, west: 124.3, east: 125.6 };

/** Percentage position on the static map, or null when a clinic has no coordinates or is off it. */
export const projectToMap = ({ latitude, longitude }: Pick<ClinicSummary, 'latitude' | 'longitude'>) => {
  if (latitude === null || longitude === null) {
    return null;
  }
  const x = ((longitude - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100;
  const y = ((BOUNDS.north - latitude) / (BOUNDS.north - BOUNDS.south)) * 100;
  return x >= 0 && x <= 100 && y >= 0 && y <= 100 ? { x, y } : null;
};

const GuestHomeScreen = ({ navigation }: { navigation: any }) => {
  const { width } = useWindowDimensions();
  const { isReady, isSyncing, dataVersion, syncNow } = useSync();

  const [home, setHome] = useState<HomeData | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [searchName, setSearchName] = useState('');
  const [searchCity, setSearchCity] = useState<string | null>(null);
  const [searchSpecialization, setSearchSpecialization] = useState<number | null>(null);
  const [picker, setPicker] = useState<'city' | 'specialization' | null>(null);

  const catalog = useCachedResource('services', getCachedServiceCatalog, fetchServiceCatalog);

  const loadLocalData = useCallback(async () => {
    try {
      const [cachedHome, cityList, specializationList, clinicList] = await Promise.all([
        getCachedHome(),
        getCities(),
        getSpecializations(),
        queryClinics(),
      ]);
      setHome(cachedHome?.value ?? null);
      setCities(cityList);
      setSpecializations(specializationList);
      setClinics(clinicList);
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
    catalog.reload();
    setRefreshing(false);
    if (!synced) {
      Alert.alert("You're offline", 'Showing the clinics saved on this device. We will update them once you reconnect.');
    }
  };

  const goToClinics = (params: Record<string, unknown> = {}) => navigation.navigate('GuestClinics', params);

  const handleSearch = () =>
    goToClinics({ search: searchName.trim(), city: searchCity, specializationId: searchSpecialization });

  const openSpecialization = (match: string) => {
    const found = specializations.find(({ name }) => name.toLowerCase().includes(match));
    goToClinics(found ? { specializationId: found.id } : {});
  };

  const openFullMap = () =>
    Linking.openURL(MAPS_URL).catch(() => Alert.alert('Maps unavailable', 'No maps app could be opened on this device.'));

  const cityOptions = useMemo(
    () => [{ label: 'Any location', value: null as string | null }, ...cities.map((city) => ({ label: city, value: city as string | null }))],
    [cities],
  );
  const specializationOptions = useMemo(
    () => [
      { label: 'Any specialization', value: null as number | null },
      ...specializations.map((spec) => ({ label: spec.name, value: spec.id as number | null })),
    ],
    [specializations],
  );
  const specializationName = specializations.find((spec) => spec.id === searchSpecialization)?.name ?? 'Any specialization';

  const featured = home?.featuredClinics ?? [];
  const reviews = (home?.recentReviews ?? []).filter((review) => review.comment).slice(0, REVIEWS_SHOWN);
  const services = (catalog.data ?? []).filter((service) => service.clinicCount > 0).slice(0, SERVICES_SHOWN);
  const pins = clinics.flatMap((clinic) => {
    const position = projectToMap(clinic);
    return position ? [{ clinic, position }] : [];
  });
  const hasNoData = loaded && !home && cities.length === 0;

  return (
    <GuestShell navigation={navigation} active="home">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[guestColors.primary]} tintColor={guestColors.primary} />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle} accessibilityRole="header">
            Find Trusted Dental Clinics Across Bukidnon
          </Text>
          <Text style={styles.heroText}>
            Search clinics, compare services, view dentists by specialization, and book appointments online with the most
            reliable dental network in the province.
          </Text>
          <View style={styles.heroActions}>
            <PrimaryButton label="Find Clinics" trailingIcon="search-outline" onPress={() => goToClinics()} style={styles.heroButton} />
            <OutlineButton label="Register Now" onPress={() => navigation.navigate('Register')} style={styles.heroButton} />
          </View>
          <Image
            source={HERO_IMAGE}
            style={[styles.heroImage, { height: (width - spacing.marginMobile * 2) / HERO_IMAGE_RATIO }]}
            resizeMode="cover"
            accessibilityLabel="Modern dental clinic treatment room"
          />
        </View>

        {/* Search panel */}
        <View style={styles.searchBand}>
          <Card style={styles.searchCard}>
            <View>
              <FieldLabel>Clinic Name</FieldLabel>
              <SearchField
                icon="business-outline"
                placeholder="Search clinic..."
                value={searchName}
                onChangeText={setSearchName}
                onSubmitEditing={handleSearch}
                accessibilityLabel="Clinic name"
              />
            </View>
            <View>
              <FieldLabel>Location</FieldLabel>
              <SelectField
                icon="location-outline"
                value={searchCity ?? 'Any location'}
                onPress={() => setPicker('city')}
                accessibilityLabel={`Location: ${searchCity ?? 'Any location'}`}
              />
            </View>
            <View>
              <FieldLabel>Specialization</FieldLabel>
              <SelectField
                icon="medical-outline"
                value={specializationName}
                onPress={() => setPicker('specialization')}
                accessibilityLabel={`Specialization: ${specializationName}`}
              />
            </View>
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch} activeOpacity={0.85} accessibilityRole="button">
              <Text style={styles.searchButtonText}>Search Now</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {!loaded || (isSyncing && !home) ? (
          <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />
        ) : hasNoData ? (
          <Message
            icon="cloud-offline-outline"
            title="No clinic data on this device yet"
            body="Connect to the internet once to download the clinic directory. After that, you can browse clinics even while offline."
            actionLabel="Try again"
            onAction={onRefresh}
          />
        ) : featured.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured Clinics</Text>
            <Text style={styles.sectionText}>Highly rated dental care centers in your vicinity.</Text>
            <TouchableOpacity style={styles.inlineLink} onPress={() => goToClinics()} accessibilityRole="link">
              <Text style={styles.linkText}>View All Clinics</Text>
              <Icon name="arrow-forward" size={16} color={guestColors.primary} />
            </TouchableOpacity>
            <View style={styles.stack}>
              {featured.map((clinic) => (
                <GuestClinicCard key={clinic.id} clinic={clinic} navigation={navigation} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Specializations */}
        <View style={[styles.section, styles.sectionWhite]}>
          <Text style={[styles.sectionTitle, styles.centered]}>Dental Specializations</Text>
          <Text style={[styles.sectionText, styles.centered]}>Whatever your need, we have the right specialist for you.</Text>
          <View style={styles.specGrid}>
            {SPECIALIZATION_CARDS.map((card) => (
              <TouchableOpacity
                key={card.name}
                style={styles.specCard}
                onPress={() => openSpecialization(card.match)}
                activeOpacity={0.85}
                accessibilityRole="link"
              >
                <View style={[styles.specIcon, { backgroundColor: card.background }]}>
                  <Icon name={card.icon} size={28} color={card.color} />
                </View>
                <Text style={styles.specName}>{card.name}</Text>
                <Text style={styles.specText}>{card.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Affordable care: published price ranges, hidden until clinics publish prices. */}
        {services.length > 0 && (
          <View style={styles.affordable}>
            <Text style={styles.eyebrow}>SERVICES</Text>
            <Text style={styles.sectionTitle}>Affordable Care for Everyone</Text>
            <Text style={styles.sectionText}>
              We bridge the gap between high-quality dental care and transparency in pricing across Bukidnon.
            </Text>
            <TouchableOpacity style={styles.inlineLink} onPress={() => navigation.navigate('GuestServices')} accessibilityRole="link">
              <Text style={styles.linkText}>See all services</Text>
            </TouchableOpacity>
            <View style={styles.stack}>
              {services.map((service) => (
                <View key={service.id} style={styles.priceCard}>
                  <Text style={styles.priceName}>{service.name}</Text>
                  {service.description ? <Text style={styles.priceText}>{service.description}</Text> : null}
                  <Text style={styles.priceValue}>{formatPriceRange(service.priceMin, service.priceMax)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Why book */}
        <View style={[styles.section, styles.sectionWhite]}>
          <Text style={[styles.sectionTitle, styles.centered, styles.whyTitle]}>Why Book Through {BRAND_NAME}?</Text>
          {WHY_BOOK.map((item) => (
            <View key={item.title} style={styles.whyItem}>
              <View style={[styles.whyIcon, { backgroundColor: item.background }]}>
                <Icon name={item.icon} size={32} color={item.color} />
              </View>
              <Text style={styles.whyName}>{item.title}</Text>
              <Text style={styles.whyText}>{item.description}</Text>
            </View>
          ))}
        </View>

        {/* Map */}
        <View style={styles.mapHeader}>
          <Text style={styles.sectionTitle}>Find Clinics Near You</Text>
          <Text style={styles.sectionText}>Interactive map showing dental partners across Bukidnon.</Text>
        </View>
        <View style={styles.map}>
          {/* Decorative and not to scale; Open Full Map is the real map. */}
          <View style={styles.mapLand} />
          {pins.map(({ clinic, position }) => (
            <TouchableOpacity
              key={clinic.id}
              style={[styles.mapPin, { left: `${position.x}%`, top: `${position.y}%` }]}
              onPress={() => navigation.navigate('GuestClinicDetails', { id: clinic.id })}
              accessibilityRole="link"
              accessibilityLabel={clinic.name}
            >
              <Icon name="location" size={20} color="#2b78b5" />
            </TouchableOpacity>
          ))}
          <Card style={styles.mapCard}>
            <Icon name="map-outline" size={40} color={guestColors.primary} />
            <Text style={styles.mapCardTitle}>Explore Local Clinics</Text>
            <Text style={styles.mapCardText}>Access our full interactive map to find the nearest clinic to your current location.</Text>
            <PrimaryButton label="Open Full Map" onPress={openFullMap} style={styles.mapCardButton} />
          </Card>
        </View>

        {/* Reviews from verified visits: testimonials are never invented. */}
        {reviews.length > 0 && (
          <View style={[styles.section, styles.sectionWhite]}>
            <Text style={[styles.sectionTitle, styles.centered, styles.reviewsTitle]}>What Patients Say</Text>
            <View style={styles.stack}>
              {reviews.map((review, index) => (
                <View key={review.id} style={styles.reviewCard}>
                  <Stars rating={review.rating} size={18} />
                  <Text style={styles.reviewQuote}>"{review.comment}"</Text>
                  <View style={styles.reviewAuthor}>
                    <Avatar name={review.patientName} color={AVATAR_COLORS[index % AVATAR_COLORS.length]} />
                    <View style={styles.flex}>
                      <Text style={styles.reviewName}>{review.patientName}</Text>
                      <Text style={styles.reviewDetail}>Patient{review.clinicName ? `, ${review.clinicName}` : ''}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <GuestFooter navigation={navigation} active="home" />
      </ScrollView>

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
    </GuestShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { textAlign: 'center' },
  loader: { marginVertical: 48 },

  hero: { backgroundColor: guestColors.surface, paddingHorizontal: spacing.marginMobile, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  heroTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700', color: guestColors.primary, marginBottom: spacing.md },
  heroText: { ...type.bodyLg, color: guestColors.textMuted, marginBottom: spacing.lg },
  heroActions: { gap: spacing.md, marginBottom: spacing.xl },
  heroButton: { minHeight: 56 },
  heroImage: { width: '100%', borderRadius: 16, borderWidth: 4, borderColor: '#ffffff', backgroundColor: guestColors.neutralSoft },

  searchBand: { paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.md },
  searchCard: { gap: spacing.md },
  searchButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: guestColors.accent },
  searchButtonText: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: '#ffffff' },

  section: { paddingHorizontal: spacing.marginMobile, paddingVertical: spacing.xl },
  sectionWhite: { backgroundColor: guestColors.surface },
  sectionTitle: { fontSize: 26, lineHeight: 32, fontWeight: '700', color: guestColors.text, marginBottom: spacing.xs },
  sectionText: { ...type.bodyLg, color: guestColors.textMuted },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  linkText: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: guestColors.primary },
  stack: { gap: spacing.md, marginTop: spacing.sm },

  specGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm, marginTop: spacing.lg },
  specCard: {
    width: '48.5%',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: guestColors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: guestColors.border,
  },
  specIcon: { width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  specName: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: guestColors.text, textAlign: 'center', marginBottom: spacing.xs },
  specText: { fontSize: 13, lineHeight: 20, color: guestColors.textMuted, textAlign: 'center' },

  affordable: { backgroundColor: '#f1f4f9', paddingHorizontal: spacing.marginMobile, paddingVertical: spacing.xl },
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
  priceCard: { padding: spacing.lg, borderRadius: 16, backgroundColor: '#fafbfd', borderWidth: 1, borderColor: '#eef1f6' },
  priceName: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: guestColors.primary, marginBottom: spacing.xs },
  priceText: { ...type.bodyMd, color: guestColors.textMuted, marginBottom: spacing.md },
  priceValue: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: guestColors.text },

  whyTitle: { marginBottom: spacing.lg },
  whyItem: { alignItems: 'center', marginBottom: spacing.xl },
  whyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  whyName: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: guestColors.text, textAlign: 'center', marginBottom: spacing.xs },
  whyText: { ...type.bodyLg, color: guestColors.textMuted, textAlign: 'center' },

  mapHeader: { backgroundColor: guestColors.surface, paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.md },
  map: { backgroundColor: '#5f8a9a', paddingHorizontal: spacing.marginMobile, paddingVertical: 56, overflow: 'hidden' },
  mapLand: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    left: '10%',
    right: '4%',
    borderRadius: 90,
    backgroundColor: '#b2c9b9',
    transform: [{ rotate: '6deg' }],
  },
  mapPin: {
    position: 'absolute',
    width: 32,
    height: 32,
    marginLeft: -16,
    marginTop: -16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  mapCard: { alignItems: 'center' },
  mapCardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: guestColors.text, marginTop: spacing.sm, marginBottom: spacing.xs },
  mapCardText: { ...type.bodyLg, color: guestColors.textMuted, textAlign: 'center', marginBottom: spacing.md },
  mapCardButton: { alignSelf: 'stretch', minHeight: 52 },

  reviewsTitle: { marginBottom: spacing.md },
  reviewCard: { padding: spacing.lg, borderRadius: 16, backgroundColor: '#f7f8fc', borderWidth: 1, borderColor: guestColors.border },
  reviewQuote: { ...type.bodyLg, fontStyle: 'italic', color: guestColors.textMuted, marginTop: spacing.sm, marginBottom: spacing.md },
  reviewAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: guestColors.border,
  },
  reviewName: { fontSize: 15, lineHeight: 20, fontWeight: '500', color: guestColors.text },
  reviewDetail: { fontSize: 12, lineHeight: 18, color: guestColors.textMuted },
});

export default GuestHomeScreen;
