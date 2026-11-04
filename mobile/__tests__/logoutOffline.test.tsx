/**
 * Logging out when the API cannot be reached still signs out on the device.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => (key === 'user' ? JSON.stringify({ id: 2, name: 'Ana', role: 'clinic_admin' }) : null)),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('../src/services/offline/patientRepository', () => ({ clearUserOfflineData: jest.fn(async () => undefined) }));

const SecureStore = require('expo-secure-store');
const http = require('../src/services/http');
const { AuthProvider, useAuth } = require('../src/context/AuthContext');

test('logout without a connection clears the session and warns instead of erroring', async () => {
  await SecureStore.setItemAsync('auth_token', 'token-123');
  const networkError = Object.assign(new Error('Network Error'), { isAxiosError: true, response: undefined });
  jest.spyOn(http.default, 'post').mockRejectedValue(networkError);
  jest.spyOn(http.default, 'get').mockRejectedValue(networkError);
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

  let auth: any;
  const Probe = () => {
    auth = useAuth();
    return null;
  };
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
  expect(auth.isAuthenticated).toBe(true);

  await ReactTestRenderer.act(async () => {
    await auth.logout();
  });

  expect(auth.isAuthenticated).toBe(false);
  expect(await SecureStore.getItemAsync('auth_token')).toBeNull();
  expect(error).not.toHaveBeenCalledWith(expect.stringMatching(/Logout/), expect.anything());
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Logged out on this device/), '');
});
