import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Set extra.apiUrl in app.json (e.g. your machine's LAN IP) to test on a
// physical device, where neither emulator loopback address is reachable.
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl ||
  Platform.select({
    android: 'http://127.0.0.1:8000/api',  // Android emulator
    ios: 'http://127.0.0.1:8000/api',      // iOS simulator
    default: 'http://127.0.0.1:8000/api'
  });

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

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      // You might want to navigate to login screen here
    }
    return Promise.reject(error);
  }
);

export default api;

export type HomeApiResponse = {
  success?: boolean;
  data?: {
    featured_clinics?: Array<any>;
    specializations?: Array<any>;
    popular_services?: Array<any>;
    recent_reviews?: Array<any>;
    stats?: {
      verified_clinics?: number;
      total_reviews?: number;
      total_specializations?: number;
    };
  };
};

export type HomeScreenData = {
  featuredClinics: Array<any>;
  specializations: Array<any>;
  popularServices: Array<any>;
  recentReviews: Array<any>;
  stats: {
    verifiedClinics: number;
    totalReviews: number;
    totalSpecializations: number;
  };
};

export const normalizeHomeData = (response: HomeApiResponse): HomeScreenData => {
  const payload = response?.data ?? {};

  return {
    featuredClinics: Array.isArray(payload.featured_clinics) ? payload.featured_clinics : [],
    specializations: Array.isArray(payload.specializations) ? payload.specializations : [],
    popularServices: Array.isArray(payload.popular_services) ? payload.popular_services : [],
    recentReviews: Array.isArray(payload.recent_reviews) ? payload.recent_reviews : [],
    stats: {
      verifiedClinics: payload.stats?.verified_clinics ?? 0,
      totalReviews: payload.stats?.total_reviews ?? 0,
      totalSpecializations: payload.stats?.total_specializations ?? 0,
    },
  };
};


export const clinicVerificationService = {
    submitVerification: (data: FormData) => {
        return api.post('/clinic-verification', data, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    getStatus: () => {
        return api.get('/clinic-verification/status');
    },
};

export const homeService = {
  getHomeData: () => api.get('/home'),
  searchClinics: (params: Record<string, unknown>) => api.get('/clinics/search', { params }),
  getClinicDetails: (id: number | string) => api.get(`/clinics/${id}`),
  getSpecializations: () => api.get('/specializations'),
  getCities: () => api.get('/cities'),
};

// Patient Service - Add these methods
export const patientService = {
  getAppointments: () => api.get('/patient/appointments'),
  createAppointment: (data: Record<string, unknown>) => api.post('/patient/appointments', data),
  cancelAppointment: (id: number | string) => api.delete(`/patient/appointments/${id}`),
  submitFeedback: (data: Record<string, unknown>) => api.post('/patient/feedback', data),
  getProfile: () => api.get('/patient/profile'),
  updateProfile: (data: Record<string, unknown>) => api.put('/patient/profile', data),
};
