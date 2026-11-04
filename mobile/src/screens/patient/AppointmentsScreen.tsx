// Appointment history with the website's filters. Includes bookings saved offline, so they
// flip to their server versions after each sync.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PatientShell from '../../components/patient/PatientShell';
import { AppointmentCard } from '../../components/patient/PatientUi';
import { guestColors, Message } from '../../components/guest/GuestUi';
import { useSync } from '../../context/SyncContext';
import { patientService } from '../../services/api';
import { Appointment, appointmentGroup, AppointmentGroup } from '../../services/patientPortal';
import { spacing } from '../../theme/tokens';

const FILTERS: Array<{ id: AppointmentGroup | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const Separator = () => <View style={styles.separator} />;

const AppointmentsScreen = ({ navigation }: { navigation: any }) => {
  const { dataVersion, syncNow } = useSync();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<AppointmentGroup | 'all'>('all');

  const load = useCallback(async () => {
    try {
      const response = await patientService.getAppointments();
      setAppointments(response.data.data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return navigation.addListener?.('focus', load);
  }, [load, navigation, dataVersion]);

  const onRefresh = async () => {
    setRefreshing(true);
    await syncNow();
    await load();
    setRefreshing(false);
  };

  const shown = filter === 'all' ? appointments : appointments.filter(({ status }) => appointmentGroup(status) === filter);

  return (
    <PatientShell navigation={navigation} title="Appointment History" active="Appointments">
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map(({ id, label }) => {
            const active = id === filter;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          renderItem={({ item }) => (
            <AppointmentCard
              appointment={item}
              onView={() => navigation.navigate('AppointmentDetails', { appointment: item })}
              onReschedule={() => navigation.navigate('Reschedule', { appointment: item })}
              onReview={() => navigation.navigate('Feedback', { appointmentId: item.id })}
            />
          )}
          ListEmptyComponent={
            <Message
              icon="calendar-outline"
              title="No appointments here"
              body={filter === 'all' ? 'Book your first visit to see it here.' : 'Try another filter.'}
              actionLabel={filter === 'all' ? 'Book an Appointment' : undefined}
              onAction={filter === 'all' ? () => navigation.navigate('BookAppointment') : undefined}
            />
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[guestColors.primary]} tintColor={guestColors.primary} />}
        />
      )}
    </PatientShell>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: 64 },
  chips: { paddingHorizontal: spacing.marginMobile, paddingVertical: spacing.md, gap: spacing.base },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.base, borderRadius: 999, borderWidth: 1, borderColor: guestColors.border, backgroundColor: guestColors.surface },
  chipActive: { backgroundColor: guestColors.primary, borderColor: guestColors.primary },
  chipText: { fontSize: 14, lineHeight: 20, color: guestColors.text },
  chipTextActive: { color: '#ffffff', fontWeight: '600' },
  list: { paddingHorizontal: spacing.marginMobile, paddingBottom: spacing.xl },
  separator: { height: spacing.sm },
});

export default AppointmentsScreen;
