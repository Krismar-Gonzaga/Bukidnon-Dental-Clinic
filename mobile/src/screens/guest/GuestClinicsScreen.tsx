// Guest clinic directory, laid out like the website's. Search and filters run against the
// on-device copy of the directory, so results are instant and identical online or offline.
// The one exception is "clinics offering a service", which only the server can answer.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSync } from '../../context/SyncContext';
import GuestClinicCard from '../../components/guest/GuestClinicCard';
import GuestShell, { GuestFooter } from '../../components/guest/GuestShell';
import { directoryAccent, guestColors, Message, PageIntro, SearchField, SelectField } from '../../components/guest/GuestUi';
import SelectSheet from '../../components/guest/SelectSheet';
import {
  ClinicSort,
  ClinicSummary,
  countClinics,
  fetchClinicIdsOfferingService,
  getCities,
  getSpecializations,
  queryClinics,
  Specialization,
} from '../../services/offline/publicRepository';
import { spacing, type } from '../../theme/tokens';

type RouteParams = {
  search?: string;
  city?: string | null;
  specializationId?: number | null;
  service?: string | null;
};

const SORT_OPTIONS: Array<{ label: string; value: ClinicSort }> = [
  { label: 'Highest Rated', value: 'rating' },
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
  const [service, setService] = useState<string | null>(params.service ?? null);
  // Null while unknown: failed means the service filter could not be applied.
  const [serviceClinicIds, setServiceClinicIds] = useState<number[] | null>(null);
  const [serviceFailed, setServiceFailed] = useState(false);
  const [sort, setSort] = useState<ClinicSort>('rating');
  const [picker, setPicker] = useState<'city' | 'specialization' | 'sort' | null>(null);

  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Picks up new filters when another screen navigates here again.
  useEffect(() => {
    setSearchInput(params.search ?? '');
    setSearch(params.search ?? '');
    setCity(params.city ?? null);
    setSpecializationId(params.specializationId ?? null);
    setService(params.service ?? null);
  }, [params.search, params.city, params.specializationId, params.service]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadService = useCallback(() => {
    setServiceClinicIds(null);
    setServiceFailed(false);
    if (!service) {
      return () => undefined;
    }
    let cancelled = false;
    fetchClinicIdsOfferingService(service)
      .then((ids) => {
        if (!cancelled) {
          setServiceClinicIds(ids);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServiceFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [service]);

  useEffect(() => loadService(), [loadService]);

  const loadFilters = useCallback(async () => {
    const [specializationList, cityList, total] = await Promise.all([getSpecializations(), getCities(), countClinics()]);
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
    setService(null);
  };

  const shown = useMemo(() => {
    if (!service) {
      return clinics;
    }
    return serviceClinicIds ? clinics.filter((clinic) => serviceClinicIds.includes(clinic.id)) : [];
  }, [clinics, service, serviceClinicIds]);

  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Highest Rated';
  const specializationName = specializations.find((spec) => spec.id === specializationId)?.name ?? 'All';

  const cityOptions = useMemo(
    () => [{ label: 'All', value: null as string | null }, ...cities.map((name) => ({ label: name, value: name as string | null }))],
    [cities],
  );
  const specializationOptions = useMemo(
    () => [{ label: 'All', value: null as number | null }, ...specializations.map((spec) => ({ label: spec.name, value: spec.id as number | null }))],
    [specializations],
  );

  const renderEmpty = () => {
    if (!loaded || (isSyncing && totalSaved === 0) || (service && !serviceClinicIds && !serviceFailed)) {
      return <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />;
    }
    if (serviceFailed) {
      return (
        <Message
          icon="cloud-offline-outline"
          title={`Could not check who offers ${service}`}
          body="This needs an internet connection."
          actionLabel="Try again"
          onAction={loadService}
        />
      );
    }
    if (totalSaved === 0) {
      return (
        <Message
          icon="cloud-offline-outline"
          title="No clinics saved yet"
          body="Connect to the internet once to download the clinic directory for offline use."
          actionLabel="Try again"
          onAction={onRefresh}
        />
      );
    }
    return (
      <Message
        icon="search-outline"
        title="No clinics match your search"
        body="Try another name, location, or specialization."
        actionLabel="Clear filters"
        onAction={clearFilters}
      />
    );
  };

  const header = (
    <View>
      <PageIntro title="Clinic Directory" description="Discover and compare verified dental clinics across Bukidnon." />
      <View style={styles.filters}>
        <Text style={styles.filterLabel}>SEARCH CLINIC</Text>
        <SearchField
          placeholder="Search by clinic name..."
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={() => setSearch(searchInput)}
          accessibilityLabel="Search clinic"
        />
        <View style={styles.filterRow}>
          <View style={styles.filterColumn}>
            <Text style={styles.filterLabel}>LOCATION</Text>
            <SelectField
              icon="location-outline"
              value={city ?? 'All'}
              onPress={() => setPicker('city')}
              accessibilityLabel={`Location: ${city ?? 'All'}`}
            />
          </View>
          <View style={styles.filterColumn}>
            <Text style={styles.filterLabel}>SPECIALIZATION</Text>
            <SelectField
              icon="medical-outline"
              value={specializationName}
              onPress={() => setPicker('specialization')}
              accessibilityLabel={`Specialization: ${specializationName}`}
            />
          </View>
        </View>
        <Text style={styles.filterLabel}>SORT BY</Text>
        <SelectField icon="options-outline" value={sortLabel} onPress={() => setPicker('sort')} accessibilityLabel={`Sort by: ${sortLabel}`} />
      </View>
      <View style={styles.results}>
        {service ? (
          <TouchableOpacity
            style={styles.serviceChip}
            onPress={() => setService(null)}
            accessibilityRole="button"
            accessibilityLabel={`Remove filter: offers ${service}`}
          >
            <Text style={styles.serviceChipText} numberOfLines={1}>
              Offers {service}
            </Text>
            <Icon name="close" size={14} color={guestColors.primary} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.resultCount} accessibilityLiveRegion="polite">
          {shown.length} {shown.length === 1 ? 'clinic' : 'clinics'} found
        </Text>
      </View>
    </View>
  );

  return (
    <GuestShell navigation={navigation} active="clinics" patientTitle="Find Clinics">
      <FlatList
        data={shown}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <View style={styles.item}>
            <GuestClinicCard clinic={item} navigation={navigation} color={directoryAccent(index)} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          <View style={styles.footer}>
            <GuestFooter navigation={navigation} active="clinics" />
          </View>
        }
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[guestColors.primary]} tintColor={guestColors.primary} />
        }
      />

      <SelectSheet
        visible={picker === 'city'}
        title="Location"
        options={cityOptions}
        selected={city}
        onSelect={setCity}
        onClose={() => setPicker(null)}
      />
      <SelectSheet
        visible={picker === 'specialization'}
        title="Specialization"
        options={specializationOptions}
        selected={specializationId}
        onSelect={setSpecializationId}
        onClose={() => setPicker(null)}
      />
      <SelectSheet
        visible={picker === 'sort'}
        title="Sort By"
        options={SORT_OPTIONS}
        selected={sort}
        onSelect={setSort}
        onClose={() => setPicker(null)}
      />
    </GuestShell>
  );
};

const styles = StyleSheet.create({
  filters: {
    padding: spacing.marginMobile,
    gap: spacing.base,
    backgroundColor: guestColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: guestColors.border,
  },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  filterColumn: { flex: 1, gap: spacing.base },
  filterLabel: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0.6, color: guestColors.text, marginTop: spacing.xs },
  results: { padding: spacing.marginMobile, paddingTop: spacing.lg, gap: spacing.sm },
  resultCount: { ...type.bodyMd, color: guestColors.text },
  serviceChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: guestColors.primarySoft,
  },
  serviceChipText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: guestColors.primary, flexShrink: 1 },
  item: { paddingHorizontal: spacing.marginMobile },
  separator: { height: spacing.md },
  loader: { marginTop: 48 },
  footer: { marginTop: spacing.xl },
});

export default GuestClinicsScreen;
