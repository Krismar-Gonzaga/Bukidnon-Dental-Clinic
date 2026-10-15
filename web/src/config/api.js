// Laravel API base URL. Override per environment with REACT_APP_API_URL
// (for example in web/.env.local).
//
// The web app signs in with a session cookie, so the API must be on the same
// site as the web app: use http://localhost:8000/api with the web app on
// http://localhost:3000 (not 127.0.0.1 for one and localhost for the other).
export const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Origin of the API, used for Sanctum's CSRF cookie route and signed links.
export const API_ORIGIN = new URL(API_BASE_URL).origin;

// Optional browser-restricted Google Maps Embed API key. Without it the app
// shows clinic lists with "Open in Google Maps" links instead of a live map.
export const GOOGLE_MAPS_EMBED_KEY = process.env.REACT_APP_GOOGLE_MAPS_EMBED_KEY || '';

// Clinic schedules are in Philippine time regardless of the viewer's device.
export const BUSINESS_TIMEZONE = 'Asia/Manila';
