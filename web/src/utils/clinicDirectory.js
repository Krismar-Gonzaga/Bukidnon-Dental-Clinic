import { ALL_OPTION } from '../config/clinicDirectory';

// Pure helpers for the clinic directory. They work on any clinic list shaped
// like the mock data, so the page can switch to API results later.

const uniqueSorted = (values) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));

export function getLocationOptions(clinics) {
  return [ALL_OPTION, ...uniqueSorted(clinics.map((clinic) => clinic.location))];
}

export function getSpecializationOptions(clinics) {
  return [
    ALL_OPTION,
    ...uniqueSorted(clinics.flatMap((clinic) => clinic.specializations)),
  ];
}

export function filterClinics(clinics, { query, location, specialization }) {
  const normalizedQuery = query.trim().toLowerCase();

  return clinics.filter(
    (clinic) =>
      (!normalizedQuery ||
        clinic.name.toLowerCase().includes(normalizedQuery)) &&
      (location === ALL_OPTION || clinic.location === location) &&
      (specialization === ALL_OPTION ||
        clinic.specializations.includes(specialization))
  );
}

const SORTERS = {
  rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
  reviews: (a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating,
  name: (a, b) => a.name.localeCompare(b.name),
};

export function sortClinics(clinics, sortKey) {
  const sorter = SORTERS[sortKey] ?? SORTERS.rating;
  return [...clinics].sort(sorter);
}

export function getPageCount(itemCount, perPage) {
  return Math.max(1, Math.ceil(itemCount / perPage));
}

export function paginate(items, page, perPage) {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}
