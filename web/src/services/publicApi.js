import apiClient, { getData, getPage } from './apiClient';
import {
  formatDurationRange,
  formatPriceRange,
  toClinicProfile,
  toClinicSummary,
  toDentistCard,
  toReview,
} from './adapters';
import { formatClockTime } from '../utils/dateTime';

// Public directory endpoints (no sign-in needed).

export async function getHome() {
  const data = await getData('/home');
  return {
    featuredClinics: data.featured_clinics.map((c) => ({
      id: String(c.id),
      name: c.name,
      location: c.address,
      rating: Number(c.rating ?? 0),
      reviewCount: null,
      tags: c.specializations ?? [],
      imageSrc: c.logo ?? null,
    })),
    reviews: data.recent_reviews.map((r) => ({
      id: String(r.id),
      name: r.patient_name,
      detail: r.clinic_name ? `Patient, ${r.clinic_name}` : 'Patient',
      rating: r.rating,
      quote: r.comment ?? '',
    })),
    serviceRates: data.service_rates.map((r) => ({
      name: r.service_name,
      startingPrice: r.starting_price,
      clinicCount: r.clinic_count,
    })),
    specializations: data.specializations,
    stats: data.stats,
  };
}

/**
 * Directory search (server-side filtering and pagination).
 * filters: { query, city, specialization, service, sort, page, perPage }
 */
export async function searchClinics({ query, city, specialization, service, sort, page = 1, perPage = 6 } = {}) {
  const { data } = await apiClient.get('/clinics/search', {
    params: {
      search: query || undefined,
      city: city || undefined,
      specialization: specialization || undefined,
      service: service || undefined,
      sort: sort || undefined,
      page,
      per_page: perPage,
    },
  });
  const pageData = data.data;
  return {
    clinics: pageData.data.map(toClinicSummary),
    total: pageData.total,
    pageCount: pageData.last_page,
    currentPage: pageData.current_page,
  };
}

export async function getClinic(clinicId) {
  return toClinicProfile(await getData(`/clinics/${clinicId}`));
}

export async function getClinicMap() {
  return (await getData('/clinics/map')).map(toClinicSummary);
}

export async function getClinicReviews(clinicId, page = 1) {
  const { items, meta } = await getPage(`/clinics/${clinicId}/reviews`, { page });
  return { reviews: items.map(toReview), meta };
}

export async function getDentists({ query, specializationId, city, page = 1, perPage = 12 } = {}) {
  const { items, meta } = await getPage('/dentists', {
    search: query || undefined,
    specialization_id: specializationId || undefined,
    city: city || undefined,
    page,
    per_page: perPage,
  });
  return { dentists: items.map((d) => toDentistCard(d)), pageCount: meta.last_page ?? 1, total: meta.total ?? items.length };
}

export async function getServiceCatalog() {
  return (await getData('/services')).map((s) => ({
    id: String(s.id),
    name: s.name,
    category: s.category ?? 'General',
    priceLabel: formatPriceRange(s.price_min, s.price_max),
    durationLabel: formatDurationRange(s.duration_min, s.duration_max),
    description: s.description ?? '',
    clinicCount: s.clinic_count,
  }));
}

export const getSpecializations = () => getData('/specializations');
export const getCities = () => getData('/cities');

/** Dates (YYYY-MM-DD) worth showing as selectable in a calendar. */
export function getAvailableDates({ clinicId, serviceRateId, dentistId, from, to }) {
  return getData(`/clinics/${clinicId}/available-dates`, {
    service_rate_id: serviceRateId,
    dentist_id: dentistId || undefined,
    from,
    to,
  });
}

/** Open slots on one date: [{ startsAt, label, dentistId, branchId }]. */
export async function getAvailability({ clinicId, serviceRateId, dentistId, date }) {
  const slots = await getData(`/clinics/${clinicId}/availability`, {
    service_rate_id: serviceRateId,
    dentist_id: dentistId || undefined,
    date,
  });
  return slots.map((slot) => ({
    startsAt: slot.starts_at,
    label: formatClockTime(slot.time),
    dentistId: slot.dentist_id,
    branchId: slot.branch_id,
  }));
}
