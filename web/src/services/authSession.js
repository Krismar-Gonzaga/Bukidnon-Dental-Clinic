// Persists the signed-in user and their Sanctum token in this browser.
// Storage can be unavailable (private mode, blocked site data), so every
// access is guarded and a missing session is treated as signed out.
const STORAGE_KEY = 'bukidnon-dental.auth';

export function getSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getToken() {
  return getSession()?.token ?? null;
}

export function saveSession({ token, user }) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
  } catch {
    // The session then lasts only until the page reloads.
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
