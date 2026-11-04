// The patient's saved clinics. Reads through the offline layer; saving and removing need a
// connection.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import PatientShell from '../../components/patient/PatientShell';
import { Notice } from '../../components/patient/PatientUi';
import { accentFor, guestColors, Message, OutlineButton, PrimaryButton, reviewsLabel, Stars } from '../../components/guest/GuestUi';
import { patientService } from '../../services/api';
import { ClinicSummary, normalizeClinic } from '../../services/offline/publicRepository';
import { spacing } from '../../theme/tokens';
import { serverMessage } from './BookAppointmentScreen';

const Separator = () => <View style={styles.separator} />;

const SavedClinicsScreen = ({ navigation }: { navigation: any }) => {
  const [clinics, setClinics] = useState<ClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await patientService.getSavedClinics();
      setClinics((response.data.data as any[]).map(normalizeClinic));
    } catch (error) {
      setProblem(serverMessage(error, 'Your saved clinics could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return navigation.addListener?.('focus', load);
  }, [load, navigation]);

  const remove = async (clinic: ClinicSummary) => {
    setProblem(null);
    const before = clinics;
    setClinics((list) => list.filter(({ id }) => id !== clinic.id));
    try {
      await patientService.unsaveClinic(clinic.id);
    } catch (error) {
      setClinics(before);
      setProblem(serverMessage(error, 'The clinic could not be removed.'));
    }
  };

  return (
    <PatientShell navigation={navigation} title="Saved Clinics" active="SavedClinics">
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />
      ) : (
        <FlatList
          data={clinics}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              {problem && <Notice tone="danger">{problem}</Notice>}
              <View style={styles.header}>
                <Text style={styles.count}>
                  {clinics.length} saved clinic{clinics.length === 1 ? '' : 's'}
                </Text>
                <TouchableOpacity style={styles.more} onPress={() => navigation.navigate('GuestClinics')} accessibilityRole="link">
                  <Icon name="add" size={18} color={guestColors.primary} />
                  <Text style={styles.moreText}>Find More Clinics</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.tile, { backgroundColor: accentFor(item.id) }]}>
                <Icon name="business-outline" size={32} color="#ffffff" />
              </View>
              <View style={styles.body}>
                <View style={styles.heading}>
                  <Text style={styles.name}>{item.name}</Text>
                  <TouchableOpacity onPress={() => remove(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${item.name} from saved clinics`}>
                    <Icon name="heart" size={22} color="#f25c5c" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.meta}>{item.city}</Text>
                <View style={styles.rating}>
                  <Stars rating={item.rating} size={14} />
                  <Text style={styles.meta}>
                    {item.rating.toFixed(1)} ({reviewsLabel(item.reviewCount)})
                  </Text>
                </View>
                <View style={styles.actions}>
                  <PrimaryButton
                    label="Book"
                    accessibilityLabel={`Book at ${item.name}`}
                    onPress={() => navigation.navigate('BookAppointment', { clinicId: item.id })}
                    style={styles.action}
                  />
                  <OutlineButton
                    label="Details"
                    accessibilityLabel={`Details of ${item.name}`}
                    onPress={() => navigation.navigate('GuestClinicDetails', { id: item.id })}
                    style={styles.action}
                  />
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Message icon="heart-outline" title="No saved clinics yet" body="Tap the heart on a clinic's page to keep it here." actionLabel="Find Clinics" onAction={() => navigation.navigate('GuestClinics')} />
          }
        />
      )}
    </PatientShell>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: 64 },
  list: { padding: spacing.marginMobile, paddingBottom: spacing.xl },
  separator: { height: spacing.sm },
  headerBlock: { gap: spacing.sm, marginBottom: spacing.md },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.base },
  count: { fontSize: 14, lineHeight: 20, color: guestColors.textMuted },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  moreText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.primary },
  card: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: guestColors.border, backgroundColor: guestColors.surface },
  tile: { width: 68, height: 68, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.base },
  name: { flex: 1, fontSize: 17, lineHeight: 23, fontWeight: '600', color: guestColors.primary },
  meta: { fontSize: 13, lineHeight: 19, color: guestColors.textMuted },
  rating: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.base, marginTop: spacing.base },
  action: { flex: 1, minHeight: 38, paddingVertical: spacing.xs },
});

export default SavedClinicsScreen;
