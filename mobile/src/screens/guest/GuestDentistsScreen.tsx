// Dentist directory, laid out like the website's. The list is saved on the device, so
// search and filtering work offline.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSync } from '../../context/SyncContext';
import GuestShell, { GuestFooter } from '../../components/guest/GuestShell';
import {
  DENTIST_ACCENT,
  guestColors,
  initialOf,
  Message,
  PageIntro,
  PrimaryButton,
  reviewsLabel,
  SearchField,
  SelectField,
  Stars,
} from '../../components/guest/GuestUi';
import SelectSheet from '../../components/guest/SelectSheet';
import { useCachedResource } from '../../components/guest/useCachedResource';
import {
  fetchDentists,
  getCachedDentists,
  getSpecializations,
  PublicDentist,
  Specialization,
} from '../../services/offline/publicRepository';
import { spacing } from '../../theme/tokens';

const Separator = () => <View style={styles.separator} />;

const GuestDentistsScreen = ({ navigation }: { navigation: any }) => {
  const { isReady, isOnline, dataVersion } = useSync();
  const directory = useCachedResource('dentists', getCachedDentists, fetchDentists);

  const [search, setSearch] = useState('');
  const [specializationId, setSpecializationId] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);

  useEffect(() => {
    if (isReady) {
      getSpecializations()
        .then(setSpecializations)
        .catch((error) => console.error('Failed to load specializations:', error));
    }
  }, [isReady, dataVersion]);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (directory.data ?? []).filter(
      (dentist) =>
        (!term || dentist.name.toLowerCase().includes(term)) &&
        (specializationId === null || dentist.specializationId === specializationId),
    );
  }, [directory.data, search, specializationId]);

  const specializationName = specializations.find((spec) => spec.id === specializationId)?.name ?? 'All';
  const options = useMemo(
    () => [{ label: 'All', value: null as number | null }, ...specializations.map((spec) => ({ label: spec.name, value: spec.id as number | null }))],
    [specializations],
  );

  const renderDentist = ({ item }: { item: PublicDentist }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initialOf(item.name)}</Text>
      </View>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.specialty}>{item.specialization ?? 'General Dentistry'}</Text>
      {item.clinics.length > 0 && (
        <View style={styles.clinicRow}>
          <Icon name="business-outline" size={14} color={guestColors.textMuted} />
          <Text style={styles.clinic}>{item.clinics.map((clinic) => clinic.name).join(', ')}</Text>
        </View>
      )}
      {item.rating !== null ? (
        <View style={styles.ratingRow}>
          <Stars rating={item.rating} />
          <Text style={styles.ratingText}>
            {item.rating.toFixed(1)} ({reviewsLabel(item.reviewCount)})
          </Text>
        </View>
      ) : (
        <Text style={[styles.ratingText, styles.noReviews]}>No reviews yet</Text>
      )}
      <View style={styles.badges}>
        <Text style={styles.badgeNeutral}>{item.yearsExperience} years exp.</Text>
        {item.isAvailable && <Text style={styles.badgeSuccess}>Available</Text>}
      </View>
      <PrimaryButton
        label="View Profile"
        accessibilityLabel={`View profile of ${item.name}`}
        onPress={() => navigation.navigate('GuestDentistProfile', { id: item.id })}
        style={styles.profileButton}
      />
    </View>
  );

  const renderEmpty = () => {
    if (directory.loading) {
      return <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />;
    }
    if (!directory.data) {
      return (
        <Message
          icon={isOnline ? 'alert-circle-outline' : 'cloud-offline-outline'}
          title={isOnline ? 'Could not load dentists' : 'Not saved on this device'}
          body={isOnline ? 'Please try again.' : 'Connect to the internet once to keep this list on your device.'}
          actionLabel="Try again"
          onAction={directory.reload}
        />
      );
    }
    return <Message icon="search-outline" title="No dentists match your search" body="Try another name or specialization." />;
  };

  return (
    <GuestShell navigation={navigation} active="dentists" patientTitle="Dentists">
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderDentist}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={renderEmpty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View>
            <PageIntro title="Dentist Directory" description="Find the right dental specialist for your needs in Bukidnon." />
            <View style={styles.filters}>
              <SearchField placeholder="Search dentist by name..." value={search} onChangeText={setSearch} accessibilityLabel="Search dentist by name" />
              <SelectField
                icon="medical-outline"
                value={specializationName}
                onPress={() => setPicking(true)}
                accessibilityLabel={`Specialization: ${specializationName}`}
              />
            </View>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <GuestFooter navigation={navigation} active="dentists" />
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={directory.refreshing && !directory.loading}
            onRefresh={directory.reload}
            colors={[guestColors.primary]}
            tintColor={guestColors.primary}
          />
        }
      />

      <SelectSheet
        visible={picking}
        title="Specialization"
        options={options}
        selected={specializationId}
        onSelect={setSpecializationId}
        onClose={() => setPicking(false)}
      />
    </GuestShell>
  );
};

const styles = StyleSheet.create({
  filters: {
    padding: spacing.marginMobile,
    gap: spacing.sm,
    backgroundColor: guestColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: guestColors.border,
    marginBottom: spacing.lg,
  },
  separator: { height: spacing.md },
  loader: { marginTop: 48 },
  footer: { marginTop: spacing.xl },

  card: {
    marginHorizontal: spacing.marginMobile,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: guestColors.border,
    backgroundColor: guestColors.surface,
  },
  avatar: { width: 80, height: 80, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, backgroundColor: DENTIST_ACCENT },
  avatarText: { fontSize: 32, lineHeight: 40, fontWeight: '700', color: '#ffffff' },
  name: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: guestColors.primary, textAlign: 'center' },
  specialty: { fontSize: 15, lineHeight: 22, color: guestColors.text, textAlign: 'center' },
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  clinic: { fontSize: 13, lineHeight: 18, color: guestColors.textMuted, flexShrink: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, marginTop: spacing.md },
  ratingText: { fontSize: 15, lineHeight: 20, color: guestColors.text },
  noReviews: { marginTop: spacing.md, color: guestColors.textMuted },
  badges: { flexDirection: 'row', gap: spacing.base, marginTop: spacing.md },
  badgeNeutral: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: guestColors.textMuted,
    backgroundColor: guestColors.neutralSoft,
    borderWidth: 1,
    borderColor: guestColors.border,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeSuccess: {
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
  profileButton: { alignSelf: 'stretch', marginTop: spacing.md, minHeight: 44 },
});

export default GuestDentistsScreen;
