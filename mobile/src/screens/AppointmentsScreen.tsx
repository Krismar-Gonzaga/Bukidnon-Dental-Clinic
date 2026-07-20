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
import { patientService } from '../services/api';

type Appointment = {
  id: number | string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | string;
  appointment_date: string;
  appointment_time?: string;
  clinic?: { name?: string; address?: string };
  dentist?: { name?: string };
  [key: string]: unknown;
};

const AppointmentsScreen = ({ navigation }: { navigation: any }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('upcoming');

  useEffect(() => {
    fetchAppointments();
  }, [activeFilter]);

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

  const onRefresh = () => {
    setRefreshing(true);
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
              await patientService.cancelAppointment(id);
              fetchAppointments();
              Alert.alert('Success', 'Appointment cancelled successfully');
            } catch {
              Alert.alert('Error', 'Failed to cancel appointment');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#48bb78';
      case 'pending':
        return '#f6ad55';
      case 'cancelled':
        return '#fc8181';
      case 'completed':
        return '#667eea';
      default:
        return '#a0aec0';
    }
  };

  const getStatusBadge = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (activeFilter === 'upcoming') {
      return apt.status === 'pending' || apt.status === 'confirmed';
    } else if (activeFilter === 'completed') {
      return apt.status === 'completed';
    } else {
      return apt.status === 'cancelled';
    }
  });

  const renderAppointmentCard = ({ item }: { item: Appointment }) => (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentHeader}>
        <Text style={styles.clinicName}>{item.clinic?.name || 'Clinic'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusBadge(item.status)}</Text>
        </View>
      </View>

      <View style={styles.appointmentDetails}>
        <View style={styles.detailRow}>
          <Icon name="calendar-outline" size={16} color="#718096" />
          <Text style={styles.detailText}>
            {new Date(item.appointment_date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="time-outline" size={16} color="#718096" />
          <Text style={styles.detailText}>{item.appointment_time || '9:00 AM'}</Text>
        </View>
        {item.dentist && (
          <View style={styles.detailRow}>
            <Icon name="medkit-outline" size={16} color="#718096" />
            <Text style={styles.detailText}>Dr. {item.dentist.name}</Text>
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
        {item.status === 'pending' && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => handleCancelAppointment(item.id)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
        {item.status === 'completed' && (
          <TouchableOpacity
            style={styles.feedbackButton}
            onPress={() => navigation.navigate('Feedback', { appointmentId: item.id })}
          >
            <Text style={styles.feedbackButtonText}>Submit Feedback</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.rescheduleButton}>
          <Text style={styles.rescheduleButtonText}>Reschedule</Text>
        </TouchableOpacity>
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
                {appointments.filter((apt) => {
                  if (filter === 'upcoming') {
                    return apt.status === 'pending' || apt.status === 'confirmed';
                  }
                  return apt.status === filter;
                }).length}
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
  );
};

const styles = StyleSheet.create({
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