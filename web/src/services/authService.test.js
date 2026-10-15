import apiClient, { ensureCsrfCookie } from './apiClient';
import { fetchCurrentUser, login, logout, register } from './authService';

jest.mock('./apiClient', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
  ensureCsrfCookie: jest.fn(),
}));

const authResponse = (role) => ({ data: { success: true, data: { user: { id: 7, name: 'Juan', role }, role } } });

test('login fetches the CSRF cookie first and returns the user (no token is stored)', async () => {
  ensureCsrfCookie.mockResolvedValue();
  apiClient.post.mockResolvedValue(authResponse('patient'));

  const user = await login({ email: 'juan@example.com', password: 'secret' });

  expect(ensureCsrfCookie).toHaveBeenCalled();
  expect(apiClient.post).toHaveBeenCalledWith('/login', { email: 'juan@example.com', password: 'secret' });
  expect(user).toEqual({ id: 7, name: 'Juan', role: 'patient' });
  expect(window.localStorage.length).toBe(0);
});

test('register sends the password confirmation the backend requires', async () => {
  ensureCsrfCookie.mockResolvedValue();
  apiClient.post.mockResolvedValue(authResponse('patient'));

  await register({ name: 'Juan', email: 'juan@example.com', phone: '0917', address: 'Malaybalay', password: 'secret-123', role: 'patient' });

  expect(apiClient.post).toHaveBeenCalledWith(
    '/register',
    expect.objectContaining({ password: 'secret-123', password_confirmation: 'secret-123', role: 'patient' })
  );
});

test('fetchCurrentUser returns null when signed out', async () => {
  apiClient.get.mockRejectedValue(Object.assign(new Error('401'), { response: { status: 401 } }));
  await expect(fetchCurrentUser()).resolves.toBeNull();
});

test('fetchCurrentUser rethrows other failures', async () => {
  apiClient.get.mockRejectedValue(Object.assign(new Error('500'), { response: { status: 500 } }));
  await expect(fetchCurrentUser()).rejects.toThrow('500');
});

test('logout resolves even when the server call fails', async () => {
  ensureCsrfCookie.mockResolvedValue();
  apiClient.post.mockRejectedValue(new Error('offline'));
  await expect(logout()).resolves.toBeUndefined();
});
