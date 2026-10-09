import { ALL_OPTION } from '../config/clinicDirectory';

// Pure helpers for the dentist directory. They work on any dentist list shaped
// like the mock data, so the page can switch to API results later.

export function getSpecialtyOptions(dentists) {
  const specialties = [...new Set(dentists.map((dentist) => dentist.specialty))];
  return [ALL_OPTION, ...specialties.sort((a, b) => a.localeCompare(b))];
}

export function filterDentists(dentists, { query, specialty }) {
  const normalizedQuery = query.trim().toLowerCase();

  return dentists.filter(
    (dentist) =>
      (!normalizedQuery ||
        dentist.name.toLowerCase().includes(normalizedQuery)) &&
      (specialty === ALL_OPTION || dentist.specialty === specialty)
  );
}

// Attaches the clinic name for display; unknown clinics resolve to null.
export function withClinicNames(dentists, clinics) {
  const clinicNames = new Map(clinics.map((clinic) => [clinic.id, clinic.name]));
  return dentists.map((dentist) => ({
    ...dentist,
    clinicName: clinicNames.get(dentist.clinicId) ?? null,
  }));
}
