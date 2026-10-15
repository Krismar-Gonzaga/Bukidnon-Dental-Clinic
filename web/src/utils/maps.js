import { GOOGLE_MAPS_EMBED_KEY } from '../config/api';

// Map helpers. Directions and search links use public Google Maps URLs and
// need no API key; the embedded map needs REACT_APP_GOOGLE_MAPS_EMBED_KEY.

// Approximate bounding box of Bukidnon, used to place pins on the static map.
const BOUNDS = { north: 8.75, south: 7.35, west: 124.3, east: 125.6 };

export const hasCoordinates = (place) =>
  Number.isFinite(Number(place?.latitude)) &&
  Number.isFinite(Number(place?.longitude)) &&
  place.latitude !== null &&
  place.longitude !== null;

/** Percentage position on the static Bukidnon map, or null when off-map. */
export function projectToMap({ latitude, longitude }) {
  const x = ((Number(longitude) - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100;
  const y = ((BOUNDS.north - Number(latitude)) / (BOUNDS.north - BOUNDS.south)) * 100;
  return x >= 0 && x <= 100 && y >= 0 && y <= 100 ? { x, y } : null;
}

const destinationOf = (clinic) =>
  hasCoordinates(clinic) ? `${clinic.latitude},${clinic.longitude}` : `${clinic.name}, ${clinic.address}`;

/** Google Maps directions; origin ({ latitude, longitude }) is optional. */
export function directionsUrl(clinic, origin) {
  const params = new URLSearchParams({ api: '1', destination: destinationOf(clinic) });
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params}`;
}

export function searchUrl(clinic) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinationOf(clinic))}`;
}

/** Google Maps Embed API URL, or null when no key is configured. */
export function embedUrl(clinic) {
  if (!GOOGLE_MAPS_EMBED_KEY || !clinic) return null;
  const params = new URLSearchParams({ key: GOOGLE_MAPS_EMBED_KEY, q: destinationOf(clinic) });
  return `https://www.google.com/maps/embed/v1/place?${params}`;
}

/**
 * Asks the browser for the current position, only when the user clicks.
 * Resolves { latitude, longitude }; the position is never sent to our API
 * or stored.
 */
export function requestCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) =>
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? 'Location permission was denied. You can still open directions without it.'
              : 'Your location could not be found.'
          )
        ),
      { timeout: 10000, maximumAge: 60000 }
    );
  });
}
