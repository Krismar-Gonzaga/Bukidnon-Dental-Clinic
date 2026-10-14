// MOCK clinic choices for the booking flow, reusing the directory mock so
// clinic details live in one place. Order and icon accents follow the Figma
// sample. Replace with the clinics API response later.
import { DIRECTORY_CLINICS } from './directoryClinics';

// accent: 1-6, maps to the --color-avatar-N tokens
const BOOKING_CLINIC_PICKS = [
  { id: 'mock-dir-2', accent: 1 },
  { id: 'mock-dir-1', accent: 2 },
  { id: 'mock-dir-3', accent: 3 },
  { id: 'mock-dir-5', accent: 5 },
  { id: 'mock-dir-4', accent: 4 },
  { id: 'mock-dir-6', accent: 6 },
];

export const BOOKING_CLINICS = BOOKING_CLINIC_PICKS.map(({ id, accent }) => ({
  ...DIRECTORY_CLINICS.find((clinic) => clinic.id === id),
  accent,
}));
