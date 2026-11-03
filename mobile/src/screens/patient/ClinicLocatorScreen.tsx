// Clinic locator: search, a list, and a preview map with the clinics' saved coordinates. It
// reads the saved directory, so it works offline. The preview is not to scale; Directions
// opens Google Maps with the real route.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import PatientShell from '../../components/patient/PatientShell';
import { accentFor, Card, guestColors, Message, OutlineButton, PrimaryButton, reviewsLabel, SearchField, Stars } from '../../components/guest/GuestUi';
import { useSync } from '../../context/SyncContext';
import { ClinicSummary, queryClinics } from '../../services/offline/publicRepository';
import { spacing } from '../../theme/tokens';
import { projectToMap } from '../guest/GuestHomeScreen';

export const directionsUrl = (clinic: ClinicSummary) => {
  const destination = clinic.latitude !== null && clinic.longitude !== null ? `${clinic.latitude},${clinic.longitude}` : `${clinic.name}, ${clinic.fullAddress}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
};

const ClinicLocatorScreen = ({ navigation }: { navigation: any }) => {
  const { isReady, dataVersion } = useSync();
  const [clinics, setClinics] = useState<ClinicSummary[] | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (isReady) {
      queryClinics({ sort: 'name' })
        .then(setClinics)
        .catch(() => setClinics([]));
    }
  }, [isReady, dataVersion]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (clinics ?? []).filter((clinic) => !term || `${clinic.name} ${clinic.city}`.toLowerCase().includes(term));
  }, [clinics, search]);

  const selected = shown.find(({ id }) => id === selectedId) ?? shown[0] ?? null;

  const openDirections = (clinic: ClinicSummary) =>
    Linking.openURL(directionsUrl(clinic)).catch(() => Alert.alert('Maps unavailable', 'No maps app could be opened on this device.'));

  return (
    <PatientShell navigation={navigation} title="Clinic Locator" active="ClinicLocator">
      {clinics === null ? (
        <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SearchField placeholder="Search clinics..." value={search} onChangeText={setSearch} accessibilityLabel="Search clinics" />

          {shown.length === 0 ? (
            <Message icon="search-outline" title="No clinics found" body={clinics.length === 0 ? 'Connect to the internet once to download the directory.' : 'Try another name or city.'} />
          ) : (
            <>
              <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {shown.map((clinic) => {
                  const isSelected = clinic.id === selected?.id;
                  return (
                    <TouchableOpacity
                      key={clinic.id}
                      style={[styles.option, isSelected && styles.optionSelected]}
                      onPress={() => setSelectedId(clinic.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={[styles.tile, { backgroundColor: accentFor(clinic.id) }]}>
                        <Icon name="business-outline" size={20} color="#ffffff" />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.name}>{clinic.name}</Text>
                        <Text style={styles.meta}>{clinic.city}</Text>
                        <Stars rating={clinic.rating} size={13} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.map}>
                <View style={styles.mapLabel}>
                  <Icon name="map-outline" size={40} color="#a9b6cc" />
                  <Text style={styles.mapTitle}>Map preview</Text>
                  <Text style={styles.mapText}>Bukidnon Province (not to scale)</Text>
                </View>
                {shown.flatMap((clinic) => {
                  const position = projectToMap(clinic);
                  if (!position) {
                    return [];
                  }
                  const isSelected = clinic.id === selected?.id;
                  return [
                    <TouchableOpacity
                      key={clinic.id}
                      style={[styles.pin, isSelected && styles.pinSelected, { left: `${position.x}%`, top: `${position.y}%` }]}
                      onPress={() => setSelectedId(clinic.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${clinic.name}`}
                    >
                      <Icon name="location-outline" size={isSelected ? 20 : 16} color="#ffffff" />
                    </TouchableOpacity>,
                  ];
                })}
              </View>

              {selected && (
                <Card style={styles.selected}>
                  <View style={styles.selectedTop}>
                    <View style={[styles.selectedTile, { backgroundColor: accentFor(selected.id) }]}>
                      <Icon name="business-outline" size={28} color="#ffffff" />
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.heading}>
                        <Text style={styles.selectedName}>{selected.name}</Text>
                        {selected.isVerified && (
                          <View style={styles.verified}>
                            <Icon name="shield-checkmark-outline" size={13} color={guestColors.successText} />
                            <Text style={styles.verifiedText}>Verified</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.meta}>{selected.fullAddress}</Text>
                      <View style={styles.rating}>
                        <Stars rating={selected.rating} size={14} />
                        <Text style={styles.meta}>
                          {selected.rating.toFixed(1)} ({reviewsLabel(selected.reviewCount)})
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => openDirections(selected)} accessibilityRole="link" hitSlop={8}>
                        <Text style={styles.link}>Directions</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <OutlineButton label="Details" accessibilityLabel={`Details of ${selected.name}`} onPress={() => navigation.navigate('GuestClinicDetails', { id: selected.id })} style={styles.flex} />
                    <PrimaryButton label="Book" accessibilityLabel={`Book at ${selected.name}`} onPress={() => navigation.navigate('BookAppointment', { clinicId: selected.id })} style={styles.flex} />
                  </View>
                </Card>
              )}
            </>
          )}
        </ScrollView>
      )}
    </PatientShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 64 },
  content: { padding: spacing.marginMobile, paddingBottom: spacing.xl, gap: spacing.sm },
  list: { maxHeight: 300 },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginBottom: spacing.base, borderRadius: 12, borderWidth: 1, borderColor: guestColors.border, backgroundColor: guestColors.surface },
  optionSelected: { borderColor: guestColors.primary, backgroundColor: guestColors.primarySoft },
  tile: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.text },
  meta: { fontSize: 13, lineHeight: 19, color: guestColors.textMuted },
  map: { height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: '#e2e6ec' },
  mapLabel: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  mapTitle: { fontSize: 14, lineHeight: 20, color: guestColors.textMuted, marginTop: spacing.xs },
  mapText: { fontSize: 12, lineHeight: 17, color: guestColors.textMuted },
  pin: { position: 'absolute', width: 30, height: 30, marginLeft: -15, marginTop: -15, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff', backgroundColor: guestColors.primary },
  pinSelected: { width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: 20 },
  selected: { padding: spacing.md },
  selectedTop: { flexDirection: 'row', gap: spacing.sm },
  selectedTile: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.base },
  selectedName: { fontSize: 17, lineHeight: 23, fontWeight: '600', color: guestColors.primary },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.base, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: guestColors.successBorder, backgroundColor: guestColors.successSoft },
  verifiedText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: guestColors.successText },
  rating: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  link: { fontSize: 14, lineHeight: 22, fontWeight: '600', color: guestColors.primary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});

export default ClinicLocatorScreen;
