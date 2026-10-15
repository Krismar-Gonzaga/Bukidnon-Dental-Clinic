// Laravel API base URL. Override per environment with REACT_APP_API_URL
// (for example in web/.env.local); the default matches `php artisan serve`.
export const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';
