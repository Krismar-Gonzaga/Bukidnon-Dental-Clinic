// Service catalog with the published price range across listed clinics, as on the website.
// Prices are each clinic's own; the range is indicative.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSync } from '../../context/SyncContext';
import GuestShell, { GuestFooter } from '../../components/guest/GuestShell';
import { guestColors, Message, PageIntro, PrimaryButton } from '../../components/guest/GuestUi';
import { useCachedResource } from '../../components/guest/useCachedResource';
import { CatalogService, fetchServiceCatalog, getCachedServiceCatalog } from '../../services/offline/publicRepository';
import { spacing, type } from '../../theme/tokens';
import { formatDurationRange, formatPriceRange } from '../../utils/format';

const ALL = 'All';

const Separator = () => <View style={styles.separator} />;

const GuestServicesScreen = ({ navigation }: { navigation: any }) => {
  const { isOnline } = useSync();
  const catalog = useCachedResource('services', getCachedServiceCatalog, fetchServiceCatalog);
  const [category, setCategory] = useState(ALL);

  const services = useMemo(() => catalog.data ?? [], [catalog.data]);
  const categories = useMemo(
    () => [ALL, ...[...new Set(services.map((service) => service.category))].sort((a, b) => a.localeCompare(b))],
    [services],
  );
  const results = category === ALL ? services : services.filter((service) => service.category === category);

  const renderService = ({ item }: { item: CatalogService }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.heading}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.category}>{item.category}</Text>
        </View>
        <View style={styles.pricing}>
          <Text style={styles.price}>{formatPriceRange(item.priceMin, item.priceMax)}</Text>
          <Text style={styles.duration}>{formatDurationRange(item.durationMin, item.durationMax)}</Text>
        </View>
      </View>
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
      {/* A clinic must be chosen before booking, so this lists the clinics offering it. */}
      {item.clinicCount > 0 && (
        <PrimaryButton
          label="Book This Service"
          accessibilityLabel={`Book ${item.name}`}
          onPress={() => navigation.navigate('GuestClinics', { service: item.name })}
        />
      )}
    </View>
  );

  const renderEmpty = () => {
    if (catalog.loading) {
      return <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />;
    }
    if (!catalog.data) {
      return (
        <Message
          icon={isOnline ? 'alert-circle-outline' : 'cloud-offline-outline'}
          title={isOnline ? 'Could not load services' : 'Not saved on this device'}
          body={isOnline ? 'Please try again.' : 'Connect to the internet once to keep this list on your device.'}
          actionLabel="Try again"
          onAction={catalog.reload}
        />
      );
    }
    return <Message icon="medical-outline" title="No services in this category yet" />;
  };

  return (
    <GuestShell navigation={navigation} active="services">
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderService}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={renderEmpty}
        ListHeaderComponent={
          <View>
            <PageIntro
              eyebrow="Services"
              title="Affordable Care for Everyone"
              description="We bridge the gap between high-quality dental care and transparency in pricing across Bukidnon."
              centered
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipBar}>
              {categories.map((name) => {
                const active = name === category;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategory(name)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <GuestFooter navigation={navigation} active="services" />
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={catalog.refreshing && !catalog.loading}
            onRefresh={catalog.reload}
            colors={[guestColors.primary]}
            tintColor={guestColors.primary}
          />
        }
      />
    </GuestShell>
  );
};

const styles = StyleSheet.create({
  chipBar: { backgroundColor: guestColors.surface, borderBottomWidth: 1, borderBottomColor: guestColors.border, marginBottom: spacing.lg },
  chips: { padding: spacing.marginMobile, gap: spacing.base },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.base,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: guestColors.border,
    backgroundColor: guestColors.surface,
  },
  chipActive: { backgroundColor: guestColors.primary, borderColor: guestColors.primary },
  chipText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: guestColors.text },
  chipTextActive: { color: '#ffffff' },
  separator: { height: spacing.md },
  loader: { marginTop: 48 },
  footer: { marginTop: spacing.xl },

  card: {
    marginHorizontal: spacing.marginMobile,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: guestColors.border,
    backgroundColor: guestColors.surface,
  },
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  heading: { flexShrink: 1, alignItems: 'flex-start', gap: spacing.xs },
  name: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: guestColors.primary },
  category: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: guestColors.textMuted,
    backgroundColor: guestColors.neutralSoft,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  pricing: { gap: 2 },
  price: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: guestColors.text },
  duration: { fontSize: 13, lineHeight: 18, color: guestColors.textMuted },
  description: { ...type.bodyMd, color: guestColors.textMuted },
});

export default GuestServicesScreen;
