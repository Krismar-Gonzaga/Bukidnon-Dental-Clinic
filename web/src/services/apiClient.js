import axios from 'axios';
import { API_BASE_URL, API_ORIGIN } from '../config/api';

// Shared HTTP client for the Laravel API.
//
// The web app authenticates with Laravel Sanctum's session cookie: the
// browser holds an HttpOnly cookie that scripts cannot read, and every
// state-changing request carries the XSRF-TOKEN cookie value as the
// X-XSRF-TOKEN header. No API token is stored in the browser.
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: 'application/json' },
  withCredentials: true,
  withXSRFToken: true,
});

let csrfRequest = null;

// Sanctum sets the XSRF-TOKEN cookie; call before login/register and after
// the session is replaced.
export function ensureCsrfCookie({ refresh = false } = {}) {
  if (!csrfRequest || refresh) {
    csrfRequest = axios
      .get(`${API_ORIGIN}/sanctum/csrf-cookie`, { withCredentials: true })
      .catch((error) => {
        csrfRequest = null;
        throw error;
      });
  }
  return csrfRequest;
}

// Listeners are told when the session has expired (401 on a signed-in call).
const sessionExpiredListeners = new Set();
export function onSessionExpired(listener) {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

apiClient.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error;

  // 419: CSRF token missing or stale. Fetch a fresh one and retry once.
  if (response?.status === 419 && config && !config.csrfRetried) {
    await ensureCsrfCookie({ refresh: true });
    return apiClient({ ...config, csrfRetried: true });
  }

  if (response?.status === 401 && !config?.skipSessionExpiry) {
    sessionExpiredListeners.forEach((listener) => listener());
  }

  return Promise.reject(error);
});

/** Unwraps the API envelope { success, data, meta } of a GET. */
export async function getData(url, params) {
  const { data } = await apiClient.get(url, { params });
  return data.data;
}

/** GET returning both data and meta (paginated lists). */
export async function getPage(url, params) {
  const { data } = await apiClient.get(url, { params });
  return { items: data.data, meta: data.meta ?? {} };
}

export default apiClient;
