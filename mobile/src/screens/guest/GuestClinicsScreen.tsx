// Guest clinic directory. Search and filters run against the on-device copy of the
// directory, so results are instant and identical online or offline.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSync } from '../../context/SyncContext';
import OfflineBanner from '../../components/common/OfflineBanner';
import ClinicImage from '../../components/guest/ClinicImage';
import SelectSheet from '../../components/guest/SelectSheet';
import {
  ClinicSort,
  ClinicSummary,
  countClinics,
  getCities,
  getSpecializations,
  queryClinics,
  Specialization,
} from '../../services/offline/publicRepository';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';
import { getOpenStatus } from '../../utils/format';

type RouteParams = {
  search?: string;
  city?: string | null;
  specializationId?: number | null;
};

const SORT_OPTIONS: Array<{ label: string; value: ClinicSort }> = [
  { label: 'Top rated', value: 'rating' },
  { label: 'Name (A–Z)', value: 'name' },
  { label: 'Newest', value: 'newest' },
];

const SEARCH_DEBOUNCE_MS = 200;

const Separator = () => <View style={styles.separator} />;

const GuestClinicsScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const params: RouteParams = route.params ?? {};
  const { isReady, isSyncing, dataVersion, syncNow } = useSync();

  const [searchInput, setSearchInput] = useState(params.search ?? '');
  const [search, setSearch] = useState(params.search ?? '');
  const [city, setCity] = useState<string | null>(params.city ?? null);
  const [specializationId, setSpecializationId] = useState<number | null>(params.specializationId ?? null);
  const [sort, setSort] = useState<ClinicSort>('rating');
  const [picker, setPicker] = useState<'city' | 'sort' | null>(null);

  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Picks up new filters when the home screen navigates here again.
  useEffect(() => {
    setSearchInput(params.search ?? '');
    setSearch(params.search ?? '');
    setCity(params.city ?? null);
    setSpecializationId(params.specializationId ?? null);
  }, [params.search, params.city, params.specializationId]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadFilters = useCallback(async () => {
    const [specializationList, cityList, total] = await Promise.all([
      getSpecializations(),
      getCities(),
      countClinics(),
    ]);
    setSpecializations(specializationList);
    setCities(cityList);
    setTotalSaved(total);
  }, []);

  useEffect(() => {
    if (isReady) {
      loadFilters().catch((error) => console.error('Failed to load filters:', error));
    }
  }, [isReady, dataVersion, loadFilters]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    let cancelled = false;
    queryClinics({ search, city, specializationId, sort })
      .then((result) => {
        if (!cancelled) {
          setClinics(result);
        }
      })
      .catch((error) => console.error('Clinic search failed:', error))
      .finally(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, dataVersion, search, city, specializationId, sort]);

  const onRefresh = async () => {
    setRefreshing(true);
    const synced = await syncNow();
    setRefreshing(false);
    if (!synced) {
      Alert.alert("You're offline", 'Showing clinics saved on this device.');
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setCity(null);
    setSpecializationId(null);
  };

  const hasFilters = Boolean(search.trim() || city || specializationId);
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Top rated';

  const cityOptions = useMemo(
    () => [
      { label: 'All locations', value: null as string | null },
      ...cities.map((name) => ({ label: name, value: name as string | null })),
    ],
    [cities],
  );

  const renderClinic = ({ item }: { item: ClinicSummary }) => {
    const status = getOpenStatus(item.openingTime, item.closingTime);
    const primarySpecialization = item.specializations[0]?.name;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.92}
        onPress={() => navigation.navigate('GuestClinicDetails', { id: item.id })}
      >
        <View>
          <ClinicImage uri={item.image} name={item.name} style={styles.cardImage} />
          <View style={styles.ratingBadge}>
            <Icon name="star" size={14} color={palette.onSecondaryContainer} />
            <Text style={styles.ratingBadgeText}>{item.rating.toFixed(1)}</Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.locationRow}>
            <Icon name="location-outline" size={18} color={palette.onSurfaceVariant} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.fullAddress || item.city}
            </Text>
          </View>
          <View style={styles.cardFooter}>
            <View style={styles.tags}>
              {primarySpecialization ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText} numberOfLines={1}>
                    {primarySpecialization}
                  </Text>
                </View>
              ) : null}
              {status ? (
                <View style={[styles.tag, !status.isOpen && styles.tagClosed]}>
                  <Text style={[styles.tagText, !status.isOpen && styles.tagClosedText]}>
                    {status.isOpen ? 'Open' : 'Closed'}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.detailsButton}>
              <Text style={styles.detailsButtonText}>View Details</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (!loaded || (isSyncing && totalSaved === 0)) {
      return <ActivityIndicator style={styles.loader} size="large" color={palette.primary} />;
    }
    if (totalSaved === 0) {
      return (
        <View style={styles.empty}>
          <Icon name="cloud-offline-outline" size={40} color={palette.outline} />
          <Text style={styles.emptyTitle}>No clinics saved yet</Text>
          <Text style={styles.emptyBody}>
            Connect to the internet once to download the clinic directory for offline use.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={onRefresh}>
            <Text style={styles.emptyButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <Icon name="search-outline" size={40} color={palette.outline} />
        <Text style={styles.emptyTitle}>No clinics match your search</Text>
        <Text style={styles.emptyBody}>Try another name, location, or specialization.</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={clearFilters}>
          <Text style={styles.emptyButtonText}>Clear filters</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const header = (
    <View>
      <View style={styles.searchBox}>
        <Icon name="search" size={20} color={palette.outline} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clinics, areas, specialties..."
          placeholderTextColor={palette.onSurfaceVariant}
          value={searchInput}
          onChangeText={setSearchInput}
          returnKeyType="search"
          onSubmitEditing={() => setSearch(searchInput)}
        />
        {searchInput.length > 0 && (
          <TouchableOpacity onPress={() => setSearchInput('')} hitSlop={10} accessibilityLabel="Clear search">
            <Icon name="close-circle" size={20} color={palette.outline} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroll}
      >
        {[{ id: null as number | null, name: 'All Clinics' }, ...specializations].map((spec) => {
          const active = specializationId === spec.id;
          return (
            <TouchableOpacity
              key={String(spec.id)}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSpecializationId(spec.id)}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{spec.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.filterButton} onPress={() => setPicker('city')}>
          <Icon name="location-outline" size={16} color={palette.primary} />
          <Text style={styles.filterButtonText} numberOfLines={1}>
            {city ?? 'All locations'}
          </Text>
          <Icon name="chevron-down" size={14} color={palette.primary} />
        </TouchableOpacity>
        <Text style={styles.resultCount}>
          {clinics.length} clinic{clinics.length === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.surfaceContainerLowest} />
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityLabel="Back">
            <Icon name="arrow-back" size={24} color={palette.primary} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Find Clinics</Text>
        </View>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setPicker('sort')}
          accessibilityLabel={`Sort: ${sortLabel}`}
        >
          <Icon name="swap-vertical-outline" size={24} color={palette.primary} />
        </TouchableOpacity>
      </View>
      <OfflineBanner />

      <FlatList
        data={clinics}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderClinic}
        ListHeaderComponent={header}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[palette.primary]}
            tintColor={palette.primary}
          />
        }
      />

      {hasFilters && clinics.length > 0 && (
        <TouchableOpacity style={styles.clearFab} onPress={clearFilters} activeOpacity={0.85}>
          <Icon name="close" size={16} color={palette.onPrimary} />
          <Text style={styles.clearFabText}>Clear filters</Text>
        </TouchableOpacity>
      )}

      <SelectSheet
        visible={picker === 'city'}
        title="Location"
        options={cityOptions}
        selected={city}
        onSelect={setCity}
        onClose={() => setPicker(null)}
      />
      <SelectSheet
        visible={picker === 'sort'}
        title="Sort clinics by"
        options={SORT_OPTIONS}
        selected={sort}
        onSelect={setSort}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
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
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  topBarTitle: { ...type.headlineMd, fontSize: 22, fontWeight: '700', color: palette.primary },
  iconButton: { padding: spacing.base, borderRadius: radius.full },

  listContent: { paddingHorizontal: spacing.marginMobile, paddingTop: spacing.lg, paddingBottom: 96 },
  separator: { height: spacing.lg },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    backgroundColor: palette.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    borderRadius: radius.xl,
  },
  searchInput: { ...type.bodyMd, flex: 1, color: palette.onSurface, paddingVertical: spacing.sm },

  chipsScroll: { marginHorizontal: -spacing.marginMobile, marginTop: spacing.lg },
  chips: { paddingHorizontal: spacing.marginMobile, gap: spacing.base },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: palette.surfaceContainerHigh,
  },
  chipActive: { backgroundColor: palette.primary },
  chipText: { ...type.labelMd, color: palette.onSurfaceVariant },
  chipTextActive: { color: palette.onPrimary },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: palette.primaryFixedDim,
    backgroundColor: palette.surfaceContainerLowest,
    maxWidth: '65%',
  },
  filterButtonText: { ...type.labelMd, color: palette.primary, flexShrink: 1 },
  resultCount: { ...type.bodyMd, color: palette.onSurfaceVariant },

  card: {
    backgroundColor: palette.surfaceContainerLowest,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    overflow: 'hidden',
    ...shadow.md,
  },
  cardImage: { width: '100%', height: 192 },
  ratingBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(103,252,198,0.92)',
  },
  ratingBadgeText: { ...type.labelMd, color: palette.onSecondaryContainer },
  cardBody: { padding: spacing.md },
  cardTitle: { ...type.titleLg, color: palette.onSurface, marginBottom: spacing.xs },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  locationText: { ...type.bodyMd, color: palette.onSurfaceVariant, flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.base },
  tags: { flexDirection: 'row', gap: spacing.xs, flexShrink: 1, flexWrap: 'wrap' },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    backgroundColor: palette.tertiaryFixed,
  },
  tagText: { ...type.labelMd, fontSize: 10, textTransform: 'uppercase', color: palette.onTertiaryFixedVariant },
  tagClosed: { backgroundColor: palette.errorContainer },
  tagClosedText: { color: palette.onErrorContainer },
  detailsButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.primary,
  },
  detailsButtonText: { ...type.labelMd, color: palette.onPrimary },

  loader: { marginTop: 48 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: 48, paddingHorizontal: spacing.lg },
  emptyTitle: { ...type.titleLg, fontSize: 18, color: palette.onSurface, textAlign: 'center' },
  emptyBody: { ...type.bodyMd, color: palette.onSurfaceVariant, textAlign: 'center' },
  emptyButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  emptyButtonText: { ...type.labelMd, color: palette.primary },

  clearFab: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: palette.inverseSurface,
    ...shadow.md,
  },
  clearFabText: { ...type.labelMd, color: palette.onPrimary },
});

export default GuestClinicsScreen;
