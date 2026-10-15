// MOCK clinic profiles for the patient clinic pages (Saved Clinics, Clinic
// Details, Clinic Locator). Built from the directory mock, so names, ratings,
// and locations live in one place. Not real business data; replace with
// GET /clinics/{id} and the saved-clinics data when the API is ready.
import { BOOKING_CLINICS } from './bookingClinics';
import { DIRECTORY_CLINICS } from './directoryClinics';

const ACCENT_COUNT = 6;

// Extra details from the Figma sample. Only Braganza Dental Clinic has a
// street, hours, phone, and email in the design; other clinics leave them out.
// mapPosition: percentage position on the placeholder map (not to scale).
const PROFILE_EXTRAS = {
  'mock-dir-2': {
    street: 'Sayre Highway',
    hours: 'Mon–Sat 8AM–5PM',
    phone: '+63 912 111 2222',
    email: 'braganza@clinic.ph',
    mapPosition: { x: 18, y: 22 },
  },
  'mock-dir-1': { mapPosition: { x: 58, y: 22 } },
  'mock-dir-3': { mapPosition: { x: 33, y: 46 } },
  'mock-dir-5': { mapPosition: { x: 69, y: 46 } },
  'mock-dir-4': { mapPosition: { x: 45, y: 69 } },
  'mock-dir-6': { mapPosition: { x: 81, y: 69 } },
};

// Clinics the sample patient has saved, in Figma order.
export const MOCK_SAVED_CLINIC_IDS = ['mock-dir-2', 'mock-dir-1', 'mock-dir-4'];

// accent: 1-6 (see --gradient-accent-N). Matches the booking flow's colors
// where the clinic is bookable.
export const PATIENT_CLINICS = DIRECTORY_CLINICS.map((clinic, index) => {
  const extras = PROFILE_EXTRAS[clinic.id] ?? {};
  const bookingAccent = BOOKING_CLINICS.find(({ id }) => id === clinic.id)?.accent;
  const area = `${clinic.location}, ${clinic.province}`;
  return {
    ...clinic,
    ...extras,
    address: extras.street ? `${extras.street}, ${area}` : area,
    accent: bookingAccent ?? (index % ACCENT_COUNT) + 1,
  };
});

export const findPatientClinic = (id) => PATIENT_CLINICS.find((clinic) => clinic.id === id);

// Clinics with a pin on the placeholder map, in Figma list order.
export const LOCATOR_CLINICS = BOOKING_CLINICS.map(({ id }) => findPatientClinic(id)).filter(
  (clinic) => clinic?.mapPosition
);
