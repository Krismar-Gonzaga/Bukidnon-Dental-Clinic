// src/screens/patient/PatientHomeScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { patientService } from '../../services/api';

// Import common components
import AppHeader from '../../components/navigation/AppHeader';
import SideDrawer from '../../components/navigation/SideDrawer';
import BottomNav from '../../components/navigation/BottomNav';
import { useSync } from '../../context/SyncContext';
import { AppNotification, fetchNotifications } from '../../services/notifications';
import { formatClockTime, formatDateKey } from '../../services/booking';

// Types
interface Appointment {
  id: number;
  clinic_name: string;
  service: string;
  /** YYYY-MM-DD in clinic time */
  dateKey: string | null;
  time: string;
  location: string;
  status: string;
}

const UPCOMING = ['pending', 'confirmed', 'reschedule_requested', 'checked_in', 'in_progress'];

const PatientHomeScreen = ({ navigation }: { navigation: any }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const { dataVersion, syncNow } = useSync();

  // Re-read after each sync so offline bookings show their server status.
  useEffect(() => {
    fetchDashboardData();
  }, [dataVersion]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const appointmentsResponse = await patientService.getAppointments();
      const transformedAppointments: Appointment[] = appointmentsResponse.data.data.map((apt: any) => ({
        id: apt.id,
        clinic_name: apt.clinic?.name || 'Dental Clinic',
        service: apt.service?.name || apt.reason || 'Dental appointment',
        dateKey: apt.appointment_date ?? null,
        time: formatClockTime(apt.appointment_time),
        location: apt.branch?.address || apt.clinic?.address || '',
        status: apt.status || 'pending',
      }));
      setAppointments(transformedAppointments);

      // Notifications are online-only; offline the section simply stays empty.
      fetchNotifications()
        .then((result) => {
          setNotifications(result.notifications.slice(0, 3));
          setUnreadCount(result.unreadCount);
        })
        .catch(() => undefined);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await syncNow();
    fetchDashboardData();
  };

  const toggleDrawer = () => {
    setDrawerVisible(!drawerVisible);
  };

  const renderAppointmentCard = () => {
    const upcomingAppointment = appointments
      .filter((a) => UPCOMING.includes(a.status) && a.dateKey)
      .sort((a, b) => `${a.dateKey} ${a.time}`.localeCompare(`${b.dateKey} ${b.time}`))[0];
    if (!upcomingAppointment) {
      return <Text style={styles.emptyText}>No upcoming visits. Book one when you're ready.</Text>;
    }

    return (
      <View style={styles.appointmentCard}>
        <View style={styles.appointmentBackgroundDecoration} />
        <View style={styles.appointmentContent}>
          <View style={styles.appointmentDateBox}>
            <Text style={styles.appointmentMonth}>
              {formatDateKey(upcomingAppointment.dateKey!, { month: 'short' })}
            </Text>
            <Text style={styles.appointmentDay}>
              {formatDateKey(upcomingAppointment.dateKey!, { day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.appointmentInfo}>
            <Text style={styles.appointmentService}>{upcomingAppointment.service}</Text>
            <View style={styles.appointmentDetailRow}>
              <Icon name="time-outline" size={16} color="#727784" />
              <Text style={styles.appointmentDetailText}>{upcomingAppointment.time}</Text>
            </View>
            {upcomingAppointment.location ? (
              <View style={styles.appointmentDetailRow}>
                <Icon name="location-outline" size={16} color="#727784" />
                <Text style={styles.appointmentDetailText}>{upcomingAppointment.location}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.appointmentActions}>
          <TouchableOpacity style={styles.checkinButton} onPress={() => navigation.navigate('Appointments')}>
            <Text style={styles.checkinButtonText}>View details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderNotificationItem = ({ item }: { item: AppNotification }) => (
    <TouchableOpacity style={styles.notificationItem} onPress={() => navigation.navigate('Notifications')}>
      <View style={[styles.notificationIcon, styles.notificationIcon_default]}>
        <Icon name={item.readAt ? 'notifications-outline' : 'notifications'} size={24} color="#fff" />
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationTime}>
            {item.createdAt
              ? new Date(item.createdAt).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })
              : ''}
          </Text>
        </View>
        <Text style={styles.notificationMessage}>{item.message}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003f87" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f9ff" />

      {/* Header */}
      <AppHeader
        onMenuPress={toggleDrawer}
        onAvatarPress={() => navigation.navigate('Profile')}
      />

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#003f87']} />
        }
      >
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingTitle}>Hello, {user?.name?.split(' ')[0] || 'there'}!</Text>
          <Text style={styles.greetingSubtitle}>Welcome back to your dental health dashboard.</Text>
        </View>

        {/* Book Appointment Button */}
        <TouchableOpacity
          style={styles.bookAppointmentButton}
          onPress={() => navigation.navigate('BookAppointment')}
          activeOpacity={0.8}
        >
          <View>
            <Text style={styles.bookAppointmentTitle}>Book Appointment</Text>
            <Text style={styles.bookAppointmentSubtitle}>Schedule your next dental visit</Text>
          </View>
          <View style={styles.bookAppointmentIcon}>
            <Icon name="add-circle" size={32} color="#003f87" />
          </View>
        </TouchableOpacity>

        {/* Next Visit Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Next Visit</Text>
          {renderAppointmentCard()}
        </View>

        {/* Health & Loyalty Bento */}
        <View style={styles.bentoGrid}>
          <View style={[styles.bentoCard, styles.healthTipCard]}>
            <View style={styles.healthTipIcon}>
              <Icon name="medkit-outline" size={24} color="#006c4f" />
            </View>
            <Text style={styles.healthTipTitle}>Daily Tip</Text>
            <Text style={styles.healthTipDescription}>
              Rinse after coffee to prevent staining.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.bentoCard, styles.loyaltyCard]}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityRole="button"
          >
            <View style={styles.loyaltyHeader}>
              <Icon name="notifications-outline" size={24} color="#003f87" />
            </View>
            <Text style={styles.loyaltyPoints}>{unreadCount}</Text>
            <Text style={styles.loyaltyLabel}>Unread updates</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Updates */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Recent Updates</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={notifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={<Text style={styles.emptyText}>No updates yet.</Text>}
          />
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav activeTab="Home" />

      {/* Side Drawer */}
      <SideDrawer
        visible={drawerVisible}
        onClose={toggleDrawer}
        activeItem="Home"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  emptyText: {
    fontSize: 14,
    color: '#727784',
    paddingVertical: 8,
  },
  container: {
    flex: 1,
    backgroundColor: '#f7f9ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f9ff',
  },
  scrollView: {
    flex: 1,
  },
  greetingSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  greetingTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#181c20',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    marginBottom: 4,
  },
  greetingSubtitle: {
    fontSize: 14,
    color: '#424752',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  bookAppointmentButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#d7e2ff',
    padding: 20,
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  bookAppointmentTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#003f87',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    marginBottom: 4,
  },
  bookAppointmentSubtitle: {
    fontSize: 14,
    color: 'rgba(0,63,135,0.8)',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  bookAppointmentIcon: {
    backgroundColor: 'rgba(0,63,135,0.2)',
    padding: 8,
    borderRadius: 50,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#424752',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003f87',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  appointmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#c2c6d4',
    position: 'relative',
    overflow: 'hidden',
  },
  appointmentBackgroundDecoration: {
    position: 'absolute',
    top: -24,
    right: -24,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0,63,135,0.05)',
  },
  appointmentContent: {
    flexDirection: 'row',
    gap: 16,
    zIndex: 1,
  },
  appointmentDateBox: {
    backgroundColor: 'rgba(0,63,135,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 64,
  },
  appointmentMonth: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003f87',
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  appointmentDay: {
    fontSize: 24,
    fontWeight: '600',
    color: '#181c20',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentService: {
    fontSize: 18,
    fontWeight: '600',
    color: '#181c20',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    marginBottom: 4,
  },
  appointmentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  appointmentDetailText: {
    fontSize: 14,
    color: '#424752',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  appointmentActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    zIndex: 1,
  },
  rescheduleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ebeef3',
    alignItems: 'center',
  },
  rescheduleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003f87',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  checkinButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#003f87',
    alignItems: 'center',
  },
  checkinButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  bentoGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
  },
  bentoCard: {
    flex: 1,
    aspectRatio: 1,
    padding: 16,
    borderRadius: 16,
    justifyContent: 'space-between',
  },
  healthTipCard: {
    backgroundColor: 'rgba(0,108,79,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,108,79,0.2)',
  },
  healthTipIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#006c4f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthTipTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#006c4f',
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  healthTipDescription: {
    fontSize: 12,
    color: '#424752',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    lineHeight: 16,
  },
  loyaltyCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c2c6d4',
  },
  loyaltyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loyaltyPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003f87',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  loyaltyPoints: {
    fontSize: 28,
    fontWeight: '600',
    color: '#181c20',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    marginTop: 4,
  },
  loyaltyLabel: {
    fontSize: 12,
    color: '#424752',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e0e3e8',
    borderRadius: 3,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#003f87',
    borderRadius: 3,
  },
  notificationItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c2c6d4',
    marginBottom: 8,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  notificationIcon_prescriptions: {
    backgroundColor: '#bfc8d0',
  },
  notificationIcon_payments: {
    backgroundColor: '#67fcc6',
  },
  notificationIcon_lab_panel: {
    backgroundColor: '#d7e2ff',
  },
  notificationIcon_default: {
    backgroundColor: '#e0e3e8',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#181c20',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  notificationTime: {
    fontSize: 10,
    color: '#424752',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#424752',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    marginBottom: 4,
  },
  notificationAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notificationActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003f87',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  bottomPadding: {
    height: 80,
  },
});

export default PatientHomeScreen;