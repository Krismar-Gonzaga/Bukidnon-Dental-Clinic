// src/navigation/AppNavigator.tsx
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import Screens
import PatientHomeScreen from '../screens/patient/PatientHomeScreen';
import AppointmentsScreen from '../screens/patient/AppointmentsScreen';
import BookAppointmentScreen from '../screens/patient/BookAppointmentScreen';
import ProfileScreen from '../screens/patient/ProfileScreen';
import FeedbackScreen from '../screens/patient/FeedbackScreen';
import AppointmentDetailsScreen from '../screens/patient/AppointmentDetailsScreen';
import RescheduleScreen from '../screens/patient/RescheduleScreen';
import SavedClinicsScreen from '../screens/patient/SavedClinicsScreen';
import ClinicLocatorScreen from '../screens/patient/ClinicLocatorScreen';
import EditProfileScreen from '../screens/patient/EditProfileScreen';
import ChangePasswordScreen from '../screens/patient/ChangePasswordScreen';
import NotificationsScreen from '../screens/patient/NotificationsScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ClinicRequirementsScreen from '../screens/auth/ClinicRequirementsScreen';
import StaffNoticeScreen from '../screens/auth/StaffNoticeScreen';
import GuestHomeScreen from '../screens/guest/GuestHomeScreen';
import GuestClinicsScreen from '../screens/guest/GuestClinicsScreen';
import GuestClinicDetailsScreen from '../screens/guest/GuestClinicDetailsScreen';
import GuestDentistsScreen from '../screens/guest/GuestDentistsScreen';
import GuestDentistProfileScreen from '../screens/guest/GuestDentistProfileScreen';
import GuestServicesScreen from '../screens/guest/GuestServicesScreen';
import GuestAboutScreen from '../screens/guest/GuestAboutScreen';
import GuestContactScreen from '../screens/guest/GuestContactScreen';
import GuestLegalScreen from '../screens/guest/GuestLegalScreen';

import ClinicDashboardScreen from '../screens/clinic/ClinicDashboardScreen';
import ClinicAppointmentsScreen from '../screens/clinic/ClinicAppointmentsScreen';
import ClinicAppointmentDetailScreen from '../screens/clinic/ClinicAppointmentDetailScreen';
import ClinicPatientsScreen from '../screens/clinic/ClinicPatientsScreen';
import ClinicPatientDetailScreen from '../screens/clinic/ClinicPatientDetailScreen';
import ClinicInventoryScreen from '../screens/clinic/ClinicInventoryScreen';
import ClinicInventoryItemScreen from '../screens/clinic/ClinicInventoryItemScreen';
import ClinicServicesScreen from '../screens/clinic/ClinicServicesScreen';
import ClinicDentistsScreen from '../screens/clinic/ClinicDentistsScreen';
import ClinicBranchesScreen from '../screens/clinic/ClinicBranchesScreen';
import ClinicStaffScreen from '../screens/clinic/ClinicStaffScreen';
import ClinicScheduleScreen from '../screens/clinic/ClinicScheduleScreen';
import ClinicRecordsScreen from '../screens/clinic/ClinicRecordsScreen';
import ClinicReviewsScreen from '../screens/clinic/ClinicReviewsScreen';
import ClinicReportsScreen from '../screens/clinic/ClinicReportsScreen';
import ClinicSettingsScreen from '../screens/clinic/ClinicSettingsScreen';
import ClinicNotificationsScreen from '../screens/clinic/ClinicNotificationsScreen';
import ClinicAccountScreen from '../screens/clinic/ClinicAccountScreen';

import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminApplicationsScreen from '../screens/admin/AdminApplicationsScreen';
import AdminApplicationDetailScreen from '../screens/admin/AdminApplicationDetailScreen';
import AdminClinicsScreen from '../screens/admin/AdminClinicsScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminReviewsScreen from '../screens/admin/AdminReviewsScreen';
import AdminAuditLogScreen from '../screens/admin/AdminAuditLogScreen';
import AdminSettingsScreen from '../screens/admin/AdminSettingsScreen';
import AdminNotificationsScreen from '../screens/admin/AdminNotificationsScreen';
import AdminAccountScreen from '../screens/admin/AdminAccountScreen';

// Import Context
import { useAuth } from '../context/AuthContext';
import { ClinicPortalProvider } from '../components/clinic/ClinicPortalContext';

const Stack = createStackNavigator();

// Clinic portal pages, the same sections as the web portal. Each page draws
// its own top bar (ClinicScreen); the server checks permissions on every call.
const CLINIC_SCREENS = [
  { name: 'ClinicDashboard', component: ClinicDashboardScreen },
  { name: 'ClinicAppointments', component: ClinicAppointmentsScreen },
  { name: 'ClinicAppointmentDetail', component: ClinicAppointmentDetailScreen },
  { name: 'ClinicPatients', component: ClinicPatientsScreen },
  { name: 'ClinicPatientDetail', component: ClinicPatientDetailScreen },
  { name: 'ClinicInventory', component: ClinicInventoryScreen },
  { name: 'ClinicInventoryItem', component: ClinicInventoryItemScreen },
  { name: 'ClinicServices', component: ClinicServicesScreen },
  { name: 'ClinicDentists', component: ClinicDentistsScreen },
  { name: 'ClinicBranches', component: ClinicBranchesScreen },
  { name: 'ClinicStaff', component: ClinicStaffScreen },
  { name: 'ClinicSchedule', component: ClinicScheduleScreen },
  { name: 'ClinicRecords', component: ClinicRecordsScreen },
  { name: 'ClinicReviews', component: ClinicReviewsScreen },
  { name: 'ClinicReports', component: ClinicReportsScreen },
  { name: 'ClinicSettings', component: ClinicSettingsScreen },
  { name: 'ClinicNotifications', component: ClinicNotificationsScreen },
  { name: 'ClinicAccount', component: ClinicAccountScreen },
];

// Detail pages slide in; switching sections from the drawer or tabs does not.
const CLINIC_PUSHED = ['ClinicAppointmentDetail', 'ClinicPatientDetail', 'ClinicInventoryItem', 'ClinicNotifications', 'ClinicAccount'];

// System administrator pages (web admin portal). Each draws its own frame
// (AdminScreen); the server checks the system_admin role on every call.
const ADMIN_SCREENS = [
  { name: 'AdminDashboard', component: AdminDashboardScreen },
  { name: 'AdminApplications', component: AdminApplicationsScreen },
  { name: 'AdminApplicationDetail', component: AdminApplicationDetailScreen },
  { name: 'AdminClinics', component: AdminClinicsScreen },
  { name: 'AdminUsers', component: AdminUsersScreen },
  { name: 'AdminReviews', component: AdminReviewsScreen },
  { name: 'AdminAuditLog', component: AdminAuditLogScreen },
  { name: 'AdminSettings', component: AdminSettingsScreen },
  { name: 'AdminNotifications', component: AdminNotificationsScreen },
  { name: 'AdminAccount', component: AdminAccountScreen },
];
const ADMIN_PUSHED = ['AdminApplicationDetail', 'AdminNotifications', 'AdminAccount'];

// Main App Navigator
export default function AppNavigator() {
  const { isAuthenticated, loading, user } = useAuth();
  const isPatient = !user?.role || user.role === 'patient';
  // System administrators get the admin portal; members of an approved
  // clinic get the clinic portal (all web sections). Owners still applying
  // use the web portal; see StaffNoticeScreen.
  const isSystemAdmin = user?.role === 'system_admin';
  const isClinicMember = Array.isArray(user?.memberships) && user.memberships.length > 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#003f87" />
      </View>
    );
  }

  return (
    <ClinicPortalProvider>
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#003f87' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: 'bold' },
          headerBackTitle: 'Back',
        }}
      >
        {isAuthenticated && isSystemAdmin ? (
          <>
            {ADMIN_SCREENS.map(({ name, component }) => (
              <Stack.Screen
                key={name}
                name={name}
                component={component as React.ComponentType<any>}
                options={{ headerShown: false, animation: ADMIN_PUSHED.includes(name) ? 'default' : 'none' }}
              />
            ))}
          </>
        ) : isAuthenticated && !isPatient && isClinicMember ? (
          <>
            {CLINIC_SCREENS.map(({ name, component }) => (
              <Stack.Screen
                key={name}
                name={name}
                component={component as React.ComponentType<any>}
                options={{ headerShown: false, animation: CLINIC_PUSHED.includes(name) ? 'default' : 'none' }}
              />
            ))}
          </>
        ) : isAuthenticated && !isPatient ? (
          <Stack.Screen name="StaffNotice" component={StaffNoticeScreen} options={{ headerShown: false }} />
        ) : isAuthenticated ? (
          <>
            {/* Each patient page renders its own PatientShell (top bar and menu). */}
            <Stack.Screen name="Home" component={PatientHomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Appointments" component={AppointmentsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Reschedule" component={RescheduleScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SavedClinics" component={SavedClinicsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ClinicLocator" component={ClinicLocatorScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ headerShown: false }} />
            {/* The public clinic and dentist pages; they adapt to a signed-in patient. */}
            <Stack.Screen name="GuestClinics" component={GuestClinicsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GuestClinicDetails" component={GuestClinicDetailsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GuestDentists" component={GuestDentistsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GuestDentistProfile" component={GuestDentistProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GuestLegal" component={GuestLegalScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            {/* No active session: the guest landing page is the first screen. Guest
                pages read from the on-device database, so they also work offline. */}
            <Stack.Screen name="GuestHome" component={GuestHomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GuestClinics" component={GuestClinicsScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="GuestClinicDetails"
              component={GuestClinicDetailsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="GuestDentists" component={GuestDentistsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GuestDentistProfile" component={GuestDentistProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GuestServices" component={GuestServicesScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GuestAbout" component={GuestAboutScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GuestContact" component={GuestContactScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GuestLegal" component={GuestLegalScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        )}

        {/* Available in both auth states: clinic_admin registration flips isAuthenticated to
            true before the user taps "Continue" on the post-register alert, which unmounts the
            unauthenticated stack. Keeping this screen outside the ternary means it's always
            reachable regardless of which stack was active when navigate() was called. */}
        <Stack.Screen
          name="ClinicRequirements"
          component={ClinicRequirementsScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
    </ClinicPortalProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
