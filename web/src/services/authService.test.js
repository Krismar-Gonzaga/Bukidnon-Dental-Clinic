import apiClient from './apiClient';
import { login, logout, register } from './authService';
import { getSession, getToken, saveSession } from './authSession';

jest.mock('./apiClient', () => ({ post: jest.fn() }));

const authResponse = (role) => ({
  data: {
    success: true,
    data: { user: { id: 7, name: 'Juan', role }, token: 'test-token', role },
  },
});

beforeEach(() => {
  window.localStorage.clear();
});

test('login posts credentials and stores the session', async () => {
  apiClient.post.mockResolvedValue(authResponse('patient'));

  const user = await login({ email: 'juan@example.com', password: 'secret' });

  expect(apiClient.post).toHaveBeenCalledWith('/login', {
    email: 'juan@example.com',
    password: 'secret',
  });
  expect(user).toEqual({ id: 7, name: 'Juan', role: 'patient' });
  expect(getToken()).toBe('test-token');
});

test('register sends the confirmation field the backend requires', async () => {
  apiClient.post.mockResolvedValue(authResponse('patient'));

  await register({
    name: 'Juan',
    email: 'juan@example.com',
    phone: '09000000000',
    address: 'Malaybalay City',
    password: 'secret-123',
    role: 'patient',
  });

  expect(apiClient.post).toHaveBeenCalledWith(
    '/register',
    expect.objectContaining({
      password: 'secret-123',
      password_confirmation: 'secret-123',
      role: 'patient',
    })
  );
  expect(getSession().user.role).toBe('patient');
});

test('failed login leaves no session behind', async () => {
  apiClient.post.mockRejectedValue({ response: { status: 401, data: {} } });

  await expect(login({ email: 'a@b.c', password: 'x' })).rejects.toBeTruthy();
  expect(getSession()).toBeNull();
});

test('logout clears the session even when the server call fails', async () => {
  saveSession({ token: 'test-token', user: { role: 'patient' } });
  apiClient.post.mockRejectedValue(new Error('offline'));

  await logout();

  expect(apiClient.post).toHaveBeenCalledWith('/logout');
  expect(getSession()).toBeNull();
});
