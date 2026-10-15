import apiClient from './apiClient';
import { clearSession, saveSession } from './authSession';

// Authentication against the Laravel API (routes/api.php):
// POST /login, POST /register, POST /logout (auth:sanctum).
// Successful login and registration both return { user, token, role }.

export async function login({ email, password }) {
  const { data } = await apiClient.post('/login', { email, password });
  const { user, token } = data.data;
  saveSession({ token, user });
  return user;
}

export async function register({ name, email, phone, address, password, role }) {
  const { data } = await apiClient.post('/register', {
    name,
    email,
    phone,
    address,
    password,
    password_confirmation: password,
    role,
  });
  const { user, token } = data.data;
  saveSession({ token, user });
  return user;
}

// Revokes the token on the server, but always signs out locally even if
// the server cannot be reached or the token has already expired.
export async function logout() {
  try {
    await apiClient.post('/logout');
  } catch {
    // Ignored: the local session is cleared below regardless.
  } finally {
    clearSession();
  }
}
