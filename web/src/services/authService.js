import apiClient, { ensureCsrfCookie } from './apiClient';

// Authentication against the Laravel API. The web app's origin gets a
// session cookie (see apiClient.js); these calls never return a token here.

// `twoFactorCode` is sent once the API has answered 423 (a code is needed).
export async function login({ email, password, twoFactorCode }) {
  await ensureCsrfCookie();
  const { data } = await apiClient.post('/login', { email, password, ...(twoFactorCode ? { two_factor_code: twoFactorCode } : {}) });
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

// Ends the server session; resolves if it had already expired. Rejects otherwise:
// the session cookie is HttpOnly, so only the server can end it, and hiding a
// failure would sign the person back in on the next reload.
export async function logout() {
  try {
    await ensureCsrfCookie();
    await apiClient.post('/logout', null, { skipSessionExpiry: true });
  } catch (error) {
    if (error.response?.status !== 401) throw error;
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
export async function updateAccount({ name, email, phone }) {
  const { data } = await apiClient.put('/profile', phone === undefined ? { name, email } : { name, email, phone });
  return data.message;
}

// Two-factor sign-in for the signed-in user (authenticator app codes).
export const startTwoFactorSetup = async (password) => (await apiClient.post('/two-factor/setup', { password })).data.data;
export const confirmTwoFactor = async (code) => (await apiClient.post('/two-factor/confirm', { code })).data.data;
export const disableTwoFactor = (password, code) => apiClient.post('/two-factor/disable', { password, code });
export const getTwoFactorStatus = async () => (await apiClient.get('/two-factor')).data.data;
export const regenerateRecoveryCodes = async (password) => (await apiClient.post('/two-factor/recovery-codes', { password })).data.data;

// Devices signed in to this account.
export const getSessions = async () => (await apiClient.get('/sessions')).data.data;
export const revokeSession = (id) => apiClient.delete(`/sessions/${encodeURIComponent(id)}`);
export const signOutOtherSessions = (password) => apiClient.post('/sessions/sign-out-others', { password });
