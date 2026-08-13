import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

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
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getErrorMessage = (err: unknown, fallback: string) => {
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
  
  
  
  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      setLoading(true);
      const response = await api.post('/login', { email, password });
      const { user: loggedInUser, token } = response.data.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(loggedInUser));

      setUser(loggedInUser);
      setError(null);
      return { success: true };
    } catch (err) {
      const message = getErrorMessage(err, 'Login failed');
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: Record<string, unknown>): Promise<AuthResult> => {
    try {
      setLoading(true);
      const response = await api.post('/register', userData);
      const { user: registeredUser, token } = response.data.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(registeredUser));

      setUser(registeredUser);
      setError(null);
      return { success: true };
    } catch (err) {
      const message = getErrorMessage(err, 'Registration failed');
      setError(message);
      const errors = axiosIsErrorWithMessage(err) ? err.response?.data?.errors : undefined;
      return { success: false, error: errors ?? message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      setUser(null);
    }
  };

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');

      if (token && userData) {
        setUser(JSON.parse(userData));
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
