/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({ children }: { children: React.ReactNode }) => children,
  }),
}));
jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({ children }: { children: React.ReactNode }) => children,
  }),
}));

jest.mock('../src/screens/ClinicsScreen', () => ({__esModule: true, default: 'ClinicsScreen'}), { virtual: true });
jest.mock('../src/screens/ClinicDetailsScreen', () => ({__esModule: true, default: 'ClinicDetailsScreen'}), { virtual: true });
jest.mock('../src/screens/AppointmentsScreen', () => ({__esModule: true, default: 'AppointmentsScreen'}), { virtual: true });
jest.mock('../src/screens/ProfileScreen', () => ({__esModule: true, default: 'ProfileScreen'}), { virtual: true });
jest.mock('../src/screens/auth/LoginScreen', () => ({__esModule: true, default: 'LoginScreen'}), { virtual: true });
jest.mock('../src/screens/auth/RegisterScreen', () => ({__esModule: true, default: 'RegisterScreen'}), { virtual: true });
jest.mock('../src/screens/BookAppointmentScreen', () => ({__esModule: true, default: 'BookAppointmentScreen'}), { virtual: true });
jest.mock('../src/screens/FeedbackScreen', () => ({__esModule: true, default: 'FeedbackScreen'}), { virtual: true });
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}), { virtual: true });

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
