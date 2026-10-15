import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { getToken } from './authSession';

// Shared HTTP client for the Laravel API. Requests carry the signed-in
// user's Sanctum token as a Bearer header when one is stored.
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
