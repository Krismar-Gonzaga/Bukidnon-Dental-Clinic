import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';
import { setOnline } from './offline/network';

console.log('API URL:', API_BASE_URL);

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
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (error) {
      console.error('Error getting token:', error);
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
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      // You might want to navigate to login screen here
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
