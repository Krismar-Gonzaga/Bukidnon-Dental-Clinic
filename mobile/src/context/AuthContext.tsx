import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import api, { API_BASE_URL, isNetworkError } from '../services/api';
import { setSessionExpiredHandler } from '../services/http';
import { clearUserOfflineData } from '../services/offline/patientRepository';
import { clearSession, readToken, readUser, saveToken, saveUser } from '../services/session';

export type User = {
  id: number | string;
  name: string;
  email: string;
  [key: string]: unknown;
};

type AuthResult = { success: true } | { success: false; error?: any };

type AuthContextType = {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (userData: Record<string, unknown>) => Promise<AuthResult>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  /** Apply saved account changes (name, email) to the signed-in user. */
  updateUser: (changes: Partial<User>) => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// No answer from the API. Usually no connection, but in development often the
// API is not reachable from the phone (see docs/SETUP.md), so say how to fix it.
const OFFLINE_MESSAGE = __DEV__
  ? `Can't reach the server at ${API_BASE_URL}. Start the API with "php artisan serve" (SERVER_HOST=0.0.0.0 in backend/.env) and keep the phone on the same network as the computer.`
  : "Can't reach the server. Check your internet connection and try again.";

const getErrorMessage = (err: unknown, fallback: string) => {
  if (isNetworkError(err)) {
    return OFFLINE_MESSAGE;
  }
  if (axiosIsErrorWithMessage(err)) {
    return err.response?.data?.message ?? fallback;
  }
  return fallback;
};

function axiosIsErrorWithMessage(
  err: unknown,
): err is { response?: { data?: { message?: string; errors?: unknown } } } {
  return typeof err === 'object' && err !== null && 'response' in err;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Login/register don't touch `loading`: it only covers restoring the saved session
  // on launch. Toggling it would unmount the navigator mid-login and, on failure,
  // drop the user back on the guest home instead of the login form.
  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const response = await api.post('/login', { email, password });
      const { user: loggedInUser, token } = response.data.data;

      await saveToken(token);
      await saveUser(loggedInUser);

      setUser(loggedInUser);
      setError(null);
      return { success: true };
    } catch (err) {
      const message = getErrorMessage(err, 'Login failed');
      setError(message);
      return { success: false, error: message };
    }
  };

  const register = async (userData: Record<string, unknown>): Promise<AuthResult> => {
    try {
      const response = await api.post('/register', userData);
      const { user: registeredUser, token } = response.data.data;

      await saveToken(token);
      await saveUser(registeredUser);

      setUser(registeredUser);
      setError(null);
      return { success: true };
    } catch (err) {
      const message = getErrorMessage(err, 'Registration failed');
      setError(message);
      const errors = axiosIsErrorWithMessage(err) ? err.response?.data?.errors : undefined;
      return { success: false, error: errors ?? message };
    }
  };

  const logout = async () => {
    try {
      await api.post('/logout');
    } catch (err) {
      // Offline logout still signs out locally; the token simply expires
      // server-side. Not an error for the user, so only a quiet warning.
      console.warn(isNetworkError(err) ? 'Logged out on this device; the server could not be reached.' : 'Logout request failed:', isNetworkError(err) ? '' : err);
    } finally {
      // Don't leave a patient's saved appointments/profile (or unsent changes) on a
      // device someone else may use next.
      if (user?.id != null) {
        await clearUserOfflineData(String(user.id)).catch((err) =>
          console.error('Failed to clear offline data:', err),
        );
      }
      await clearSession();
      setUser(null);
    }
  };

  const updateUser = (changes: Partial<User>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...changes };
      saveUser(next).catch(() => undefined);
      return next;
    });
  };

  const checkAuth = async () => {
    try {
      const token = await readToken();
      const savedUser = await readUser<User>();

      if (token && savedUser) {
        setUser(savedUser);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Auth check error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
    // The server rejected the saved token (expired, revoked, suspended):
    // show the signed-out screens. Offline data stays until a real logout.
    setSessionExpiredHandler(() => setUser(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        checkAuth,
        updateUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
