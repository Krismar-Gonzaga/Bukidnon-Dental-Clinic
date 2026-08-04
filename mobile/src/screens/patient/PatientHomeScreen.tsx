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

// Types
interface Appointment {
  id: number;
  clinic_name: string;
  service: string;
  date: string;
  time: string;
  location: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}

interface Notification {
  id: number;
  title: string;
  message: string;
  time: string;
  icon: string;
  action?: string;
}

interface LoyaltyData {
  points: number;
  nextReward: string;
  progress: number;
}

const PatientHomeScreen = ({ navigation }: { navigation: any }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loyaltyData] = useState<LoyaltyData>({
    points: 1250,
    nextReward: 'Free Cleaning',
    progress: 75,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const appointmentsResponse = await patientService.getAppointments();
      const transformedAppointments = appointmentsResponse.data.data.map((apt: any) => ({
        id: apt.id,
        clinic_name: apt.clinic?.name || 'Dental Clinic',
        service: apt.reason || apt.notes || 'Dental Checkup',
        date: new Date(apt.appointment_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        time: apt.appointment_time || '10:30 AM',
        location: apt.clinic?.address || 'Main Practice, Malaybalay',
        status: apt.status || 'pending',
      }));
      setAppointments(transformedAppointments);

      // Mock notifications (replace with API call)
      setNotifications([
        {
          id: 1,
          title: 'New Prescription',
          message: 'Post-treatment medication guide ready.',
          time: '2h ago',
          icon: 'prescriptions',
          action: 'Download PDF',
        },
        {
          id: 2,
          title: 'Billing Statement',
          message: 'Statement for Oct 12 procedure is available.',
          time: 'Yesterday',
          icon: 'payments',
          action: 'Pay Now',
        },
        {
          id: 3,
          title: 'Lab Results Ready',
          message: 'X-ray analysis from your last screening.',
          time: 'Oct 14',
          icon: 'lab-panel',
          action: 'View Results',
        },
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const toggleDrawer = () => {
    setDrawerVisible(!drawerVisible);
  };

  const renderAppointmentCard = () => {
    const upcomingAppointment = appointments.find(a => a.status === 'pending' || a.status === 'confirmed');
    if (!upcomingAppointment) return null;

    return (
      <View style={styles.appointmentCard}>
        <View style={styles.appointmentBackgroundDecoration} />
        <View style={styles.appointmentContent}>
          <View style={styles.appointmentDateBox}>
            <Text style={styles.appointmentMonth}>
              {new Date(upcomingAppointment.date).toLocaleDateString('en-US', { month: 'short' })}
            </Text>
            <Text style={styles.appointmentDay}>
              {new Date(upcomingAppointment.date).getDate()}
            </Text>
          </View>
          <View style={styles.appointmentInfo}>
            <Text style={styles.appointmentService}>{upcomingAppointment.service}</Text>
            <View style={styles.appointmentDetailRow}>
              <Icon name="time-outline" size={16} color="#727784" />
              <Text style={styles.appointmentDetailText}>{upcomingAppointment.time}</Text>
            </View>
            <View style={styles.appointmentDetailRow}>
              <Icon name="location-outline" size={16} color="#727784" />
              <Text style={styles.appointmentDetailText}>{upcomingAppointment.location}</Text>
            </View>
          </View>
        </View>
        <View style={styles.appointmentActions}>
          <TouchableOpacity style={styles.rescheduleButton}>
            <Text style={styles.rescheduleButtonText}>Reschedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkinButton}>
            <Text style={styles.checkinButtonText}>Check-in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const notificationIconColors: Record<string, { backgroundColor: string }> = {
    prescriptions: styles.notificationIcon_prescriptions,
    payments: styles.notificationIcon_payments,
    'lab-panel': styles.notificationIcon_lab_panel,
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <View style={styles.notificationItem}>
      <View style={[
        styles.notificationIcon,
        notificationIconColors[item.icon] || styles.notificationIcon_default
      ]}>
        <Icon name={item.icon as any} size={24} color="#fff" />
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <Text style={styles.notificationTime}>{item.time}</Text>
        </View>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        {item.action && (
          <TouchableOpacity style={styles.notificationAction}>
            <Icon name="download-outline" size={16} color="#003f87" />
            <Text style={styles.notificationActionText}>{item.action}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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
        onNotificationPress={() => console.log('Notifications')}
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
          <Text style={styles.greetingTitle}>Hello, {user?.name?.split(' ')[0] || 'Maria'}!</Text>
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

          <View style={[styles.bentoCard, styles.loyaltyCard]}>
            <View style={styles.loyaltyHeader}>
              <Icon name="star" size={24} color="#003f87" />
              <Text style={styles.loyaltyPercent}>75%</Text>
            </View>
            <Text style={styles.loyaltyPoints}>{loyaltyData.points.toLocaleString()}</Text>
            <Text style={styles.loyaltyLabel}>Loyalty Pts</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${loyaltyData.progress}%` }]} />
            </View>
          </View>
        </View>

        {/* Recent Updates */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Recent Updates</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={notifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
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