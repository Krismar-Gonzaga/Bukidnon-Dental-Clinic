import api from './http';
import { offlinePatientService } from './offline/patientRepository';

export { isNetworkError } from './http';
export { API_BASE_URL } from './config';

export default api;

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

// Raw public endpoints. Screens should prefer services/offline/publicRepository,
// which serves these from the local database so they keep working offline.
export const homeService = {
  getHomeData: () => api.get('/home'),
  searchClinics: (params: Record<string, unknown>) => api.get('/clinics/search', { params }),
  getClinicDetails: (id: number | string) => api.get(`/clinics/${id}`),
  getSpecializations: () => api.get('/specializations'),
  getCities: () => api.get('/cities'),
};

// Patient endpoints are offline-first: reads fall back to the device copy and writes
// made without a connection are queued and synced automatically (see SyncContext).
export const patientService = offlinePatientService;
