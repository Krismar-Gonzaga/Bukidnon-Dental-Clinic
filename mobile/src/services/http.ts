import axios from 'axios';
import { API_BASE_URL } from './config';
import { setOnline } from './offline/network';
import { clearSession, readToken } from './session';

if (__DEV__) {
  console.log('API URL:', API_BASE_URL);
}

// Called when the server rejects the saved token (expired, revoked, account
// suspended) so the app can return to the sign-in screen.
let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  onSessionExpired = handler;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await readToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch {
      return config;
    }
  },
  (error) => Promise.reject(error)
);

// Response interceptor. Every round trip doubles as a connectivity signal: any
// response (even a 4xx/5xx) proves the server is reachable, while a request that
// never got a response means we're offline.
api.interceptors.response.use(
  (response) => {
    setOnline(true);
    return response;
  },
  async (error) => {
    if (isNetworkError(error)) {
      setOnline(false);
    } else {
      setOnline(true);
    }
    // A signed-in request was rejected: the token expired or was revoked
    // (password change, suspension). Forget it and return to sign-in. The
    // login request itself also answers 401 for a wrong password; skip that.
    const isLoginAttempt = String(error.config?.url ?? '').endsWith('/login');
    if (error.response?.status === 401 && !isLoginAttempt) {
      await clearSession();
      onSessionExpired?.();
    }
    return Promise.reject(error);
  }
);

/**
 * True when the request failed because the server couldn't be reached
 * (no connection, DNS failure, timeout) rather than because it answered with an error.
 */
export const isNetworkError = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  if (axios.isCancel(error)) {
    return false;
  }
  return !error.response;
};

export default api;
