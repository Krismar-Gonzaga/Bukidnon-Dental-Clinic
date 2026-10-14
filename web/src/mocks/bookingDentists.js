// MOCK dentist choices for the booking flow, reusing the dentist directory
// mock. The Figma sample shows these five under the selected clinic, so the
// same list is shown for every clinic for now. The dentists API should
// return only the selected clinic's dentists.
import { DIRECTORY_DENTISTS } from './directoryDentists';

// accent: 1-6, maps to the --color-avatar-N tokens
const BOOKING_DENTIST_PICKS = [
  { id: 'mock-dentist-1', accent: 1 },
  { id: 'mock-dentist-2', accent: 2 },
  { id: 'mock-dentist-3', accent: 3 },
  { id: 'mock-dentist-4', accent: 4 },
  { id: 'mock-dentist-5', accent: 5 },
];

export const BOOKING_DENTISTS = BOOKING_DENTIST_PICKS.map(({ id, accent }) => ({
  ...DIRECTORY_DENTISTS.find((dentist) => dentist.id === id),
  accent,
}));
