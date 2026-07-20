import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://10.0.2.2:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
