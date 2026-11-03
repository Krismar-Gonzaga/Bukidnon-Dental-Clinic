import apiClient, { ensureCsrfCookie } from './apiClient';

// Authentication against the Laravel API. The web app's origin gets a
// session cookie (see apiClient.js); these calls never return a token here.

export async function login({ email, password }) {
  await ensureCsrfCookie();
  const { data } = await apiClient.post('/login', { email, password });
  // The session id changed; the next write needs a fresh CSRF token.
  await ensureCsrfCookie({ refresh: true });
  return data.data.user;
}

export async function register({ name, email, phone, address, password, role }) {
  await ensureCsrfCookie();
  const { data } = await apiClient.post('/register', {
    name,
    email,
    phone,
    address,
    password,
    password_confirmation: password,
    role,
  });
  await ensureCsrfCookie({ refresh: true });
  return data.data.user;
}

// Ends the server session; resolves even if the session had already expired.
export async function logout() {
  try {
    await ensureCsrfCookie();
    await apiClient.post('/logout', null, { skipSessionExpiry: true });
  } catch {
    // Signed out locally regardless.
  }
}

/**
 * The signed-in user, or null when there is no valid session. GET /session
 * answers 200 with no data for guests, so a guest visit does not log a
 * failed request in the browser console.
 */
export async function fetchCurrentUser() {
  try {
    const { data } = await apiClient.get('/session', { skipSessionExpiry: true });
    return data.data ?? null;
  } catch (error) {
    if (error.response?.status === 401) return null;
    throw error;
  }
}

export async function requestPasswordReset(email) {
  await ensureCsrfCookie();
  const { data } = await apiClient.post('/forgot-password', { email });
  return data.message;
}

export async function resetPassword({ token, email, password }) {
  await ensureCsrfCookie();
  const { data } = await apiClient.post('/reset-password', {
    token,
    email,
    password,
    password_confirmation: password,
  });
  return data.message;
}

export async function changePassword({ currentPassword, newPassword }) {
  const { data } = await apiClient.post('/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
    new_password_confirmation: newPassword,
  });
  await ensureCsrfCookie({ refresh: true });
  return data.message;
}

/** Name and email of the signed-in account (PUT /profile). */
export async function updateAccount({ name, email }) {
  const { data } = await apiClient.put('/profile', { name, email });
  return data.message;
}
