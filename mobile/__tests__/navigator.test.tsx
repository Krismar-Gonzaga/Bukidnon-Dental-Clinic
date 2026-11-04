/**
 * Which screens each signed-in account gets (src/navigation/AppNavigator.tsx).
 */
import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

let mockAuth: any = {};

jest.mock('../src/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('@react-navigation/stack', () => {
  const { Text: RNText } = require('react-native');
  return {
    createStackNavigator: () => ({
      Navigator: ({ children }: { children: React.ReactNode }) => children,
      Screen: ({ name }: { name: string }) => <RNText>{`screen:${name}`}</RNText>,
    }),
  };
});
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
[
  'patient/PatientHomeScreen', 'patient/AppointmentsScreen', 'patient/AppointmentDetailsScreen', 'patient/RescheduleScreen', 'patient/SavedClinicsScreen', 'patient/ClinicLocatorScreen', 'patient/EditProfileScreen', 'patient/ChangePasswordScreen',
  'patient/BookAppointmentScreen', 'patient/ProfileScreen', 'patient/FeedbackScreen', 'patient/NotificationsScreen',
  'auth/LoginScreen', 'auth/RegisterScreen', 'auth/ClinicRequirementsScreen', 'auth/StaffNoticeScreen',
  'guest/GuestHomeScreen', 'guest/GuestClinicsScreen', 'guest/GuestClinicDetailsScreen',
  'guest/GuestDentistsScreen', 'guest/GuestDentistProfileScreen', 'guest/GuestServicesScreen', 'guest/GuestAboutScreen', 'guest/GuestContactScreen', 'guest/GuestLegalScreen',
  'clinic/ClinicDashboardScreen', 'clinic/ClinicAppointmentsScreen', 'clinic/ClinicAppointmentDetailScreen',
  'clinic/ClinicPatientsScreen', 'clinic/ClinicPatientDetailScreen', 'clinic/ClinicInventoryScreen',
  'clinic/ClinicInventoryItemScreen', 'clinic/ClinicServicesScreen', 'clinic/ClinicDentistsScreen',
  'clinic/ClinicBranchesScreen', 'clinic/ClinicStaffScreen', 'clinic/ClinicReviewsScreen', 'clinic/ClinicReportsScreen',
  'clinic/ClinicSettingsScreen', 'clinic/ClinicNotificationsScreen', 'clinic/ClinicAccountScreen',
  'clinic/ClinicScheduleScreen', 'clinic/ClinicRecordsScreen', 'clinic/ClinicDentistProfileScreen', 'clinic/ClinicAddMemberScreens',
  'clinic/ClinicWalkInScreen', 'clinic/ClinicSubscriptionScreens', 'clinic/ClinicAdminSettingsScreen', 'clinic/ClinicCheckInScreen', 'clinic/ClinicDentistScheduleScreen',
  'clinic/dentist/DentistAppointments', 'clinic/dentist/DentistAppointmentDetail', 'clinic/dentist/DentalChartScreen', 'clinic/dentist/DentistPatients', 'clinic/dentist/ClinicalRecordsScreens', 'clinic/dentist/ClinicalDocumentsScreens', 'clinic/dentist/ImagingFollowUpScreens', 'clinic/dentist/DentistScheduleProfile',
  'admin/AdminDashboardScreen', 'admin/AdminApplicationsScreen', 'admin/AdminApplicationDetailScreen', 'admin/AdminClinicsScreen',
  'admin/AdminClinicDetailScreen', 'admin/AdminSubscriptionsScreen', 'admin/AdminSubscriptionDetailScreen', 'admin/AdminReportsScreen',
  'admin/AdminAnnouncementsScreen', 'admin/AdminAnnouncementFormScreen',
  'admin/AdminUsersScreen', 'admin/AdminReviewsScreen', 'admin/AdminAuditLogScreen', 'admin/AdminSettingsScreen',
  'admin/AdminNotificationsScreen', 'admin/AdminAccountScreen',
].forEach((path) => jest.doMock(`../src/screens/${path}`, () => ({ __esModule: true, default: () => null }), { virtual: true }));

const AppNavigator = require('../src/navigation/AppNavigator').default;

const screensFor = (user: any) => {
  mockAuth = { isAuthenticated: Boolean(user), loading: false, user };
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<AppNavigator />);
  });
  return tree!.root.findAllByType(Text).map((node) => String(node.props.children));
};

const membership = (role: string) => [{ clinic_id: 10, clinic_name: 'Demo Clinic', role, permissions: ['clinic.view'] }];

test.each([
  ['clinic_admin', 'clinic_admin'],
  ['dentist', 'dentist'],
  ['staff', 'staff'],
])('a %s with a clinic membership gets the clinic portal, not patient screens', (role, membershipRole) => {
  const screens = screensFor({ id: 2, name: 'Ana', role, memberships: membership(membershipRole) });
  expect(screens).toContain('screen:ClinicDashboard');
  expect(screens).not.toContain('screen:Home');
  expect(screens).not.toContain('screen:BookAppointment');
});

test('clinic members get every clinic portal section from the web portal', () => {
  const screens = screensFor({ id: 2, name: 'Ana', role: 'clinic_admin', memberships: membership('clinic_admin') });
  [
    'ClinicDashboard', 'ClinicAppointments', 'ClinicAppointmentDetail', 'ClinicPatients', 'ClinicPatientDetail',
    'ClinicInventory', 'ClinicInventoryItem', 'ClinicServices', 'ClinicDentists', 'ClinicBranches', 'ClinicStaff',
    'ClinicReviews', 'ClinicReports', 'ClinicSettings', 'ClinicNotifications', 'ClinicAccount', 'ClinicSchedule', 'ClinicRecords',
    'ClinicDentistProfile', 'ClinicAddDentist', 'ClinicAddStaff', 'ClinicWalkIn', 'ClinicSubscription', 'ClinicPaymentProof', 'ClinicAdminSettings', 'ClinicCheckIn', 'ClinicDentistSchedule',
  ].forEach((name) => expect(screens).toContain(`screen:${name}`));
});

test('a patient gets the patient screens', () => {
  const screens = screensFor({ id: 1, name: 'Juan', role: 'patient', memberships: [] });
  [
    'Home', 'BookAppointment', 'Appointments', 'AppointmentDetails', 'Reschedule', 'Feedback', 'Notifications', 'SavedClinics',
    'ClinicLocator', 'Profile', 'EditProfile', 'ChangePassword', 'GuestClinics', 'GuestClinicDetails', 'GuestDentistProfile',
  ].forEach((name) => expect(screens).toContain(`screen:${name}`));
  expect(screens).not.toContain('screen:ClinicDashboard');
});

test('system admins get the admin portal, not the web-portal notice', () => {
  const screens = screensFor({ id: 6, name: 'Sam', role: 'system_admin', memberships: [] });
  [
    'AdminDashboard', 'AdminApplications', 'AdminApplicationDetail', 'AdminClinics', 'AdminClinicDetail', 'AdminSubscriptions', 'AdminSubscriptionDetail', 'AdminReports', 'AdminAnnouncements', 'AdminAnnouncementForm', 'AdminUsers',
    'AdminReviews', 'AdminAuditLog', 'AdminSettings', 'AdminNotifications', 'AdminAccount',
  ].forEach((name) => expect(screens).toContain(`screen:${name}`));
  expect(screens).not.toContain('screen:StaffNotice');
  expect(screens).not.toContain('screen:ClinicDashboard');
});

test('clinic owners still applying get the web-portal notice', () => {
  const screens = screensFor({ id: 7, name: 'Owner', role: 'clinic_admin', memberships: [] });
  expect(screens).toContain('screen:StaffNotice');
  expect(screens).not.toContain('screen:AdminDashboard');
});
