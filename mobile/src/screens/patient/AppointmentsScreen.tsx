// src/screens/AppointmentsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { patientService } from '../../services/api';
import AppHeader from '../../components/navigation/AppHeader';
import SideDrawer from '../../components/navigation/SideDrawer';
import BottomNav from '../../components/navigation/BottomNav';
import { useSync } from '../../context/SyncContext';
import { formatClockTime, formatDateKey } from '../../services/booking';

const formatDateLabel = (item: { appointment_date?: string; starts_at?: string }) => {
  const key = item.starts_at?.slice(0, 10) ?? item.appointment_date?.slice(0, 10);
  return key ? formatDateKey(key, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : 'Date to be confirmed';
};

type Appointment = {
  id: number | string;
  status: string;
  starts_at?: string;
  appointment_date: string;
  appointment_time?: string;
  clinic?: { id?: number; name?: string; address?: string };
  dentist?: { id?: number; name?: string };
  service?: { id?: number; name?: string };
  cancellation_reason?: string | null;
  requested_starts_at?: string | null;
  has_review?: boolean;
  [key: string]: unknown;
};

// Backend statuses grouped into the three tabs.
const GROUPS: Record<string, string[]> = {
  upcoming: ['pending', 'confirmed', 'reschedule_requested', 'checked_in', 'in_progress'],
  completed: ['completed'],
  cancelled: ['cancelled', 'rejected', 'no_show'],
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Awaiting approval',
  confirmed: 'Confirmed',
  reschedule_requested: 'Reschedule requested',
  checked_in: 'Checked in',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Declined',
  no_show: 'Missed',
};

const CANCELLABLE = ['pending', 'confirmed', 'reschedule_requested'];
const RESCHEDULABLE = ['pending', 'confirmed'];

const isLocal = (id: unknown) => String(id).startsWith('local-');

const AppointmentsScreen = ({ navigation }: { navigation: any }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('upcoming');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const toggleDrawer = () => setDrawerVisible((v) => !v);
  const { dataVersion, syncNow } = useSync();

  // Also re-read after each sync so queued bookings flip to their server versions.
  useEffect(() => {
    fetchAppointments();
  }, [activeFilter, dataVersion]);

  const fetchAppointments = async () => {
    try {
      const response = await patientService.getAppointments();
      setAppointments(response.data.data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await syncNow();
    fetchAppointments();
  };

  const handleCancelAppointment = (id: number | string) => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await patientService.cancelAppointment(id);
              fetchAppointments();
              Alert.alert(
                'Success',
                response.data?.queued
                  ? "You're offline. The cancellation is saved and will be sent once you're back online."
                  : 'Appointment cancelled successfully',
              );
            } catch (error: any) {
              // e.g. "Appointments can only be changed online up to 24 hours before…"
              Alert.alert('Not cancelled', error?.response?.data?.message ?? 'Failed to cancel appointment');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    if (status === 'pending' || status === 'reschedule_requested') {
      return '#f6ad55';
    }
    if (GROUPS.upcoming.includes(status)) {
      return '#48bb78';
    }
    if (status === 'completed') {
      return '#667eea';
    }
    return '#fc8181';
  };

  const getStatusBadge = (status: string) => STATUS_LABELS[status] ?? status;

  const handleReschedule = (item: Appointment) => {
    navigation.navigate('BookAppointment', {
      reschedule: {
        appointmentId: item.id,
        clinicId: item.clinic?.id,
        serviceRateId: item.service?.id,
        dentistId: item.dentist?.id,
        currentLabel: `${formatDateLabel(item)} at ${formatClockTime(item.appointment_time)}`,
      },
    });
  };

  const filteredAppointments = appointments.filter((apt) => (GROUPS[activeFilter] ?? []).includes(apt.status));

  const renderAppointmentCard = ({ item }: { item: Appointment }) => (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentHeader}>
        <Text style={styles.clinicName}>{item.clinic?.name || 'Clinic'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusBadge(item.status)}</Text>
        </View>
      </View>
      {Boolean(item.sync_status) && (
        <View style={styles.syncRow}>
          <Icon
            name={item.sync_status === 'failed' ? 'alert-circle-outline' : 'cloud-upload-outline'}
            size={14}
            color={item.sync_status === 'failed' ? '#ba1a1a' : '#727784'}
          />
          <Text style={[styles.syncText, item.sync_status === 'failed' && styles.syncTextFailed]}>
            {item.sync_status === 'failed'
              ? `Not synced: ${String(item.sync_error ?? 'rejected by the server')}`
              : 'Saved offline · waiting to sync'}
          </Text>
        </View>
      )}

      <View style={styles.appointmentDetails}>
        <View style={styles.detailRow}>
          <Icon name="calendar-outline" size={16} color="#718096" />
          <Text style={styles.detailText}>{formatDateLabel(item)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="time-outline" size={16} color="#718096" />
          <Text style={styles.detailText}>{formatClockTime(item.appointment_time) || 'Time to be confirmed'}</Text>
        </View>
        {item.service?.name && (
          <View style={styles.detailRow}>
            <Icon name="clipboard-outline" size={16} color="#718096" />
            <Text style={styles.detailText}>{item.service.name}</Text>
          </View>
        )}
        {item.dentist?.name && (
          <View style={styles.detailRow}>
            <Icon name="medkit-outline" size={16} color="#718096" />
            <Text style={styles.detailText}>{item.dentist.name}</Text>
          </View>
        )}
        {item.status === 'reschedule_requested' && item.requested_starts_at && (
          <View style={styles.detailRow}>
            <Icon name="swap-horizontal-outline" size={16} color="#718096" />
            <Text style={styles.detailText}>
              Requested: {formatDateKey(item.requested_starts_at.slice(0, 10))} at{' '}
              {formatClockTime(item.requested_starts_at.slice(11, 16))}
            </Text>
          </View>
        )}
        {Boolean(item.cancellation_reason) && GROUPS.cancelled.includes(item.status) && (
          <View style={styles.detailRow}>
            <Icon name="information-circle-outline" size={16} color="#718096" />
            <Text style={styles.detailText}>{String(item.cancellation_reason)}</Text>
          </View>
        )}
        <View style={styles.detailRow}>
          <Icon name="location-outline" size={16} color="#718096" />
          <Text style={styles.detailText}>
            {item.clinic?.address || 'Address not available'}
          </Text>
        </View>
      </View>

      <View style={styles.appointmentActions}>
        {CANCELLABLE.includes(item.status) && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => handleCancelAppointment(item.id)}
          >
            <Text style={styles.cancelButtonText}>{item.status === 'pending' ? 'Cancel Request' : 'Cancel'}</Text>
          </TouchableOpacity>
        )}
        {item.status === 'completed' && !item.has_review && (
          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => navigation.navigate('Feedback', { appointmentId: item.id })}
          >
            <Text style={styles.feedbackButtonText}>Leave a Review</Text>
          </TouchableOpacity>
        )}
        {RESCHEDULABLE.includes(item.status) && !isLocal(item.id) && item.service?.id && item.dentist?.id && (
          <TouchableOpacity style={styles.rescheduleButton} onPress={() => handleReschedule(item)}>
            <Text style={styles.rescheduleButtonText}>Reschedule</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <View style={styles.screenRoot}>
      <AppHeader onMenuPress={toggleDrawer} onAvatarPress={() => navigation.navigate('Profile')} />
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Appointments</Text>
        <TouchableOpacity
          style={styles.newAppointmentButton}
          onPress={() => navigation.navigate('Clinics')}
        >
          <Icon name="add-circle-outline" size={24} color="#667eea" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        {['upcoming', 'completed', 'cancelled'].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterButton, activeFilter === filter && styles.activeFilterButton]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === filter && styles.activeFilterText,
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>
                {appointments.filter((apt) => GROUPS[filter].includes(apt.status)).length}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredAppointments}
        renderItem={renderAppointmentCard}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="calendar-outline" size={60} color="#e2e8f0" />
            <Text style={styles.emptyText}>No appointments found</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('Clinics')}
            >
              <Text style={styles.emptyButtonText}>Find a Clinic</Text>
            </TouchableOpacity>
          </View>
        }
      />
      </View>
      <BottomNav activeTab="Appointments" />
      <SideDrawer visible={drawerVisible} onClose={toggleDrawer} activeItem="Appointments" />
    </View>
  );
};

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  newAppointmentButton: {
    padding: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeFilterButton: {
    backgroundColor: '#ebf8ff',
  },
  filterText: {
    fontSize: 14,
    color: '#a0aec0',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#667eea',
  },
  filterCount: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 6,
  },
  filterCountText: {
    fontSize: 12,
    color: '#4a5568',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clinicName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: -4,
    marginBottom: 8,
  },
  syncText: {
    fontSize: 12,
    color: '#727784',
    flexShrink: 1,
  },
  syncTextFailed: {
    color: '#ba1a1a',
  },
  appointmentDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#4a5568',
    marginLeft: 8,
  },
  appointmentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fc8181',
  },
  cancelButtonText: {
    color: '#fc8181',
    fontSize: 14,
    fontWeight: '500',
  },
  feedbackButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ebf8ff',
    borderWidth: 1,
    borderColor: '#667eea',
  },
  feedbackButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },
  rescheduleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rescheduleButtonText: {
    color: '#4a5568',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#a0aec0',
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AppointmentsScreen;