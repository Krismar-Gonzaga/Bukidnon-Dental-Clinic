// Offline-first access to the public (no login) data the guest pages show.
//
// Reads always come from SQLite so screens render instantly and identically with or
// without a connection; syncPublicData() refreshes that local copy from the API.
import api from '../http';
import { getDatabase, readCache, writeCache } from './database';

export type ClinicSpecialization = { id: number | null; name: string };

export type ClinicSummary = {
  id: number;
  name: string;
  description: string | null;
  address: string;
  city: string;
  province: string;
  fullAddress: string;
  contactNumber: string | null;
  email: string | null;
  image: string | null;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  openingTime: string | null;
  closingTime: string | null;
  createdAt: string | null;
  latitude: number | null;
  longitude: number | null;
  specializations: ClinicSpecialization[];
};

export type ClinicService = {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  durationMinutes: number;
};

export type ClinicDentist = {
  id: number;
  name: string;
  specialization: string | null;
  yearsExperience: number;
  /** Published reviews of this dentist's visits; null until there are any. */
  rating: number | null;
  reviewCount: number;
  /** Has weekly hours, so patients can book them. */
  isAvailable: boolean;
};

export type ClinicBranch = {
  id: number;
  name: string;
  address: string;
  isMain: boolean;
  /** Weekly hours: day 0 = Sunday ... 6 = Saturday; closed days are absent. */
  hours: Array<{ day: number; opensAt: string; closesAt: string }>;
};

export type ClinicReview = {
  id: number;
  patientName: string;
  clinicName: string | null;
  rating: number;
  comment: string;
  /** Display date ("2 weeks ago" or "Jan 5, 2026"). */
  date: string;
  /** ISO timestamp when the API provides one. */
  createdAt: string | null;
};

export type ClinicDetails = ClinicSummary & {
  reviews: ClinicReview[];
  services: ClinicService[];
  dentists: ClinicDentist[];
  branches: ClinicBranch[];
};

export type DentistClinic = { id: number; name: string; city: string; address: string };

export type DentistSchedule = { day: number; startsAt: string; endsAt: string };

export type PublicDentist = {
  id: number;
  name: string;
  specialization: string | null;
  specializationId: number | null;
  yearsExperience: number;
  rating: number | null;
  reviewCount: number;
  isAvailable: boolean;
  qualifications: string | null;
  bio: string | null;
  clinics: DentistClinic[];
  schedules: DentistSchedule[];
};

export type CatalogService = {
  id: number;
  name: string;
  category: string;
  description: string;
  priceMin: number | null;
  priceMax: number | null;
  durationMin: number | null;
  durationMax: number | null;
  clinicCount: number;
};

export type ContactMessage = {
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  message: string;
};

export type Specialization = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
};

export type PopularService = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
};

export type ServiceRateSummary = {
  serviceName: string;
  startingPrice: number;
  currency: string;
  clinicCount: number;
};

export type HomeData = {
  featuredClinics: ClinicSummary[];
  specializations: Specialization[];
  popularServices: PopularService[];
  serviceRates: ServiceRateSummary[];
  recentReviews: ClinicReview[];
  stats: {
    verifiedClinics: number;
    totalReviews: number;
    totalSpecializations: number;
    /** Null until counted by the server (or on a home page saved by an older version). */
    patients?: number | null;
    municipalities?: number | null;
    satisfactionRate?: number | null;
  };
  meta: { title: string | null; description: string | null };
};

export type ClinicSort = 'rating' | 'name' | 'newest';

export type ClinicFilters = {
  search?: string;
  city?: string | null;
  specializationId?: number | null;
  sort?: ClinicSort;
};

const KEYS = {
  home: 'public:home',
  specializations: 'public:specializations',
  clinicDetails: (id: number | string) => `public:clinic:${id}`,
  dentists: 'public:dentists',
  dentist: (id: number | string) => `public:dentist:${id}`,
  services: 'public:services',
  lastSync: 'public:last_sync',
};

// Hard stop for the directory download in case the API misreports last_page.
const MAX_DIRECTORY_PAGES = 100;

// ---------------------------------------------------------------------------
// Normalisation: the API returns clinics in two shapes (the /home summary and the
// full model from /clinics/*). Screens only ever see ClinicSummary.
// ---------------------------------------------------------------------------

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

export const normalizeClinic = (raw: any): ClinicSummary => {
  const hasFullModel = raw?.province !== undefined;
  const address = toText(raw?.address) ?? '';
  const city = toText(raw?.city) ?? '';
  const province = toText(raw?.province) ?? 'Bukidnon';
  const fullAddress = hasFullModel
    ? [address, city, province].filter(Boolean).join(', ')
    : address; // /home already sends the full address

  const specializations: ClinicSpecialization[] = Array.isArray(raw?.specializations)
    ? raw.specializations
        .map((spec: any) =>
          typeof spec === 'string'
            ? { id: null, name: spec }
            : { id: spec?.id != null ? Number(spec.id) : null, name: String(spec?.name ?? '') },
        )
        .filter((spec: ClinicSpecialization) => spec.name !== '')
    : [];

  return {
    id: Number(raw?.id),
    name: String(raw?.name ?? 'Dental Clinic'),
    description: toText(raw?.description),
    address,
    city,
    province,
    fullAddress,
    contactNumber: toText(raw?.contact_number),
    email: toText(raw?.email),
    image: toText(raw?.image) ?? toText(raw?.logo),
    rating: toNumber(raw?.rating ?? raw?.rating_stars),
    reviewCount: toNumber(raw?.review_count ?? raw?.reviews_count),
    isVerified: Boolean(raw?.is_verified),
    openingTime: toText(raw?.opening_time),
    closingTime: toText(raw?.closing_time),
    createdAt: toText(raw?.created_at),
    latitude: raw?.latitude != null ? toNumber(raw.latitude) : null,
    longitude: raw?.longitude != null ? toNumber(raw.longitude) : null,
    specializations,
  };
};

const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);

export const normalizeClinicDetails = (raw: any): ClinicDetails => {
  const clinic = normalizeClinic(raw);
  return {
    ...clinic,
    reviews: list(raw?.reviews).map((review: any) => normalizeReview(review, clinic.name)),
    services: list(raw?.services).map((service: any) => ({
      id: Number(service.id),
      name: String(service.name ?? ''),
      description: toText(service.description) ?? '',
      price: toNumber(service.price),
      currency: toText(service.currency) ?? 'PHP',
      durationMinutes: toNumber(service.duration_minutes, 30),
    })),
    dentists: list(raw?.dentists).map((dentist: any) => ({
      id: Number(dentist.id),
      name: String(dentist.name ?? 'Dentist'),
      specialization: toText(dentist.specialization),
      yearsExperience: toNumber(dentist.years_experience),
      rating: typeof dentist.rating === 'number' ? dentist.rating : null,
      reviewCount: toNumber(dentist.review_count),
      isAvailable: dentist.is_available ?? dentist.is_active !== false,
    })),
    branches: list(raw?.branches).map((branch: any) => ({
      id: Number(branch.id),
      name: String(branch.name ?? 'Branch'),
      address: [toText(branch.address), toText(branch.city)].filter(Boolean).join(', '),
      isMain: Boolean(branch.is_main),
      hours: list(branch.operating_hours).map((h: any) => ({
        day: toNumber(h.day_of_week),
        opensAt: String(h.opens_at ?? ''),
        closesAt: String(h.closes_at ?? ''),
      })),
    })),
  };
};

const formatReviewDate = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value; // already human readable, e.g. "2 weeks ago"
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const normalizeReview = (raw: any, clinicName: string | null = null): ClinicReview => ({
  id: Number(raw?.id),
  patientName: toText(raw?.patient_name) ?? toText(raw?.patient?.user?.name) ?? 'Verified Patient',
  clinicName: toText(raw?.clinic_name) ?? clinicName,
  rating: Math.max(0, Math.min(5, Math.round(toNumber(raw?.rating)))),
  comment: toText(raw?.comment) ?? '',
  date: formatReviewDate(raw?.date ?? raw?.created_at),
  createdAt: toText(raw?.created_at),
});

const normalizeSpecialization = (raw: any): Specialization => ({
  id: Number(raw?.id),
  name: String(raw?.name ?? ''),
  description: toText(raw?.description),
  icon: toText(raw?.icon),
});

const normalizeHome = (body: any): HomeData => {
  const data = body?.data ?? {};
  const list = (value: unknown) => (Array.isArray(value) ? value : []);
  return {
    featuredClinics: list(data.featured_clinics).map(normalizeClinic),
    specializations: list(data.specializations).map(normalizeSpecialization),
    popularServices: list(data.popular_services).map((service: any) => ({
      id: Number(service?.id),
      name: String(service?.name ?? ''),
      description: toText(service?.description),
      icon: toText(service?.icon),
      color: toText(service?.color),
    })),
    serviceRates: list(data.service_rates).map((rate: any) => ({
      serviceName: String(rate?.service_name ?? ''),
      startingPrice: toNumber(rate?.starting_price),
      currency: toText(rate?.currency) ?? 'PHP',
      clinicCount: toNumber(rate?.clinic_count),
    })),
    recentReviews: list(data.recent_reviews).map((review: any) => normalizeReview(review)),
    stats: {
      verifiedClinics: toNumber(data.stats?.verified_clinics),
      totalReviews: toNumber(data.stats?.total_reviews),
      totalSpecializations: toNumber(data.stats?.total_specializations),
      patients: data.stats?.patients ?? null,
      municipalities: data.stats?.municipalities ?? null,
      satisfactionRate: data.stats?.satisfaction_rate ?? null,
    },
    meta: {
      title: toText(data.meta?.page_title),
      description: toText(data.meta?.page_description),
    },
  };
};

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

export const getCachedHome = () => readCache<HomeData>(KEYS.home);

export const fetchHome = async (): Promise<HomeData> => {
  const response = await api.get('/home');
  const home = normalizeHome(response.data);
  await writeCache(KEYS.home, home);
  return home;
};

// ---------------------------------------------------------------------------
// Dentists
// ---------------------------------------------------------------------------

const normalizeDentist = (raw: any): PublicDentist => ({
  id: Number(raw?.id),
  name: String(raw?.name ?? 'Dentist'),
  specialization: toText(raw?.specialization),
  specializationId: raw?.specialization_id != null ? Number(raw.specialization_id) : null,
  yearsExperience: toNumber(raw?.years_experience),
  rating: typeof raw?.rating === 'number' ? raw.rating : null,
  reviewCount: toNumber(raw?.review_count),
  isAvailable: raw?.is_available ?? raw?.is_active !== false,
  qualifications: toText(raw?.qualifications),
  bio: toText(raw?.bio),
  clinics: list(raw?.clinics).map((clinic: any) => ({
    id: Number(clinic.id),
    name: String(clinic.name ?? ''),
    city: String(clinic.city ?? ''),
    address: String(clinic.address ?? ''),
  })),
  schedules: list(raw?.schedules).map((schedule: any) => ({
    day: toNumber(schedule.day_of_week),
    startsAt: String(schedule.starts_at ?? ''),
    endsAt: String(schedule.ends_at ?? ''),
  })),
});

export const getCachedDentists = () => readCache<PublicDentist[]>(KEYS.dentists);

/** The whole directory: search and filters then run on the device, like the clinics. */
export const fetchDentists = async (): Promise<PublicDentist[]> => {
  const dentists: PublicDentist[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const response = await api.get('/dentists', { params: { page, per_page: 100 } });
    dentists.push(...list(response.data?.data).map(normalizeDentist));
    lastPage = toNumber(response.data?.meta?.last_page, 1);
    page += 1;
  } while (page <= lastPage && page <= MAX_DIRECTORY_PAGES);
  await writeCache(KEYS.dentists, dentists);
  return dentists;
};

/** A saved profile, or the directory entry (which has no hours) if it was never opened. */
export const getCachedDentist = async (id: number | string) => {
  const saved = await readCache<PublicDentist>(KEYS.dentist(id));
  if (saved) {
    return saved;
  }
  const directory = await getCachedDentists();
  const entry = directory?.value.find((dentist) => dentist.id === Number(id));
  return entry && directory ? { value: entry, updatedAt: directory.updatedAt } : null;
};

export const fetchDentist = async (id: number | string): Promise<PublicDentist> => {
  const response = await api.get(`/dentists/${id}`);
  const dentist = normalizeDentist(response.data?.data);
  await writeCache(KEYS.dentist(id), dentist);
  return dentist;
};

// ---------------------------------------------------------------------------
// Service catalog and contact form
// ---------------------------------------------------------------------------

const toNumberOrNull = (value: unknown) => (value == null ? null : toNumber(value));

export const getCachedServiceCatalog = () => readCache<CatalogService[]>(KEYS.services);

export const fetchServiceCatalog = async (): Promise<CatalogService[]> => {
  const response = await api.get('/services');
  const services = list(response.data?.data).map((service: any) => ({
    id: Number(service.id),
    name: String(service.name ?? ''),
    category: toText(service.category) ?? 'General',
    description: toText(service.description) ?? '',
    priceMin: toNumberOrNull(service.price_min),
    priceMax: toNumberOrNull(service.price_max),
    durationMin: toNumberOrNull(service.duration_min),
    durationMax: toNumberOrNull(service.duration_max),
    clinicCount: toNumber(service.clinic_count),
  }));
  await writeCache(KEYS.services, services);
  return services;
};

/** Clinics offering a service. The saved directory has no prices, so this needs a connection. */
export const fetchClinicIdsOfferingService = async (service: string): Promise<number[]> => {
  const ids: number[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const response = await api.get('/clinics/search', { params: { page, service } });
    const payload = response.data?.data ?? {};
    ids.push(...list(payload.data).map((clinic: any) => Number(clinic.id)));
    lastPage = toNumber(payload.last_page, 1);
    page += 1;
  } while (page <= lastPage && page <= MAX_DIRECTORY_PAGES);
  return ids;
};

/** Sends straight away: a message is never queued for later, the sender is told if it failed. */
export const sendContactMessage = (message: ContactMessage) => api.post('/contact', message);

// ---------------------------------------------------------------------------
// Specializations
// ---------------------------------------------------------------------------

export const getSpecializations = async (): Promise<Specialization[]> => {
  const cached = await readCache<Specialization[]>(KEYS.specializations);
  if (cached?.value.length) {
    return cached.value;
  }
  const home = await getCachedHome();
  return home?.value.specializations ?? [];
};

export const fetchSpecializations = async (): Promise<Specialization[]> => {
  const response = await api.get('/specializations');
  const list = Array.isArray(response.data?.data)
    ? response.data.data.map(normalizeSpecialization)
    : [];
  await writeCache(KEYS.specializations, list);
  return list;
};

// ---------------------------------------------------------------------------
// Clinic directory (local table)
// ---------------------------------------------------------------------------

type ClinicRow = { data: string };

const buildSearchText = (clinic: ClinicSummary) =>
  [clinic.name, clinic.city, clinic.address, clinic.province, ...clinic.specializations.map((s) => s.name)]
    .join(' ')
    .toLowerCase();

/** Downloads every verified clinic and atomically replaces the local directory. */
export const syncClinicDirectory = async (): Promise<number> => {
  const clinics: ClinicSummary[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await api.get('/clinics/search', {
      params: { page, sort: 'rating' },
    });
    const payload = response.data?.data ?? {};
    const items = Array.isArray(payload.data) ? payload.data : [];
    clinics.push(...items.map(normalizeClinic));
    lastPage = toNumber(payload.last_page, 1);
    page += 1;
  } while (page <= lastPage && page <= MAX_DIRECTORY_PAGES);

  // Only touch the local copy once the whole download succeeded, so a dropped
  // connection mid-sync never leaves a half-empty directory behind.
  const db = await getDatabase();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM clinics');
    for (const clinic of clinics) {
      const specializationIds = clinic.specializations
        .map((spec) => spec.id)
        .filter((id): id is number => id !== null);
      await txn.runAsync(
        `INSERT OR REPLACE INTO clinics
           (id, name, city, address, rating, specialization_ids, search_text, created_at, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        clinic.id,
        clinic.name,
        clinic.city,
        clinic.address,
        clinic.rating,
        `,${specializationIds.join(',')},`,
        buildSearchText(clinic),
        clinic.createdAt,
        JSON.stringify(clinic),
        now,
      );
    }
  });

  return clinics.length;
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

export const queryClinics = async (filters: ClinicFilters = {}): Promise<ClinicSummary[]> => {
  const db = await getDatabase();
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    // Every word must match somewhere (name, city, address or specialization).
    search.split(/\s+/).forEach((word) => {
      clauses.push("search_text LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(word)}%`);
    });
  }
  if (filters.city) {
    clauses.push('city = ?');
    params.push(filters.city);
  }
  if (filters.specializationId) {
    clauses.push('specialization_ids LIKE ?');
    params.push(`%,${filters.specializationId},%`);
  }

  const orderBy = {
    rating: 'rating DESC, name COLLATE NOCASE ASC',
    name: 'name COLLATE NOCASE ASC',
    newest: 'created_at DESC, id DESC',
  }[filters.sort ?? 'rating'];

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await db.getAllAsync<ClinicRow>(
    `SELECT data FROM clinics ${where} ORDER BY ${orderBy}`,
    params,
  );
  return rows.map((row) => JSON.parse(row.data) as ClinicSummary);
};

export const countClinics = async (): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM clinics');
  return row?.total ?? 0;
};

export const getCities = async (): Promise<string[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ city: string }>(
    "SELECT DISTINCT city FROM clinics WHERE city IS NOT NULL AND city <> '' ORDER BY city COLLATE NOCASE",
  );
  return rows.map((row) => row.city);
};

export const getClinicSummary = async (id: number | string): Promise<ClinicSummary | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ClinicRow>('SELECT data FROM clinics WHERE id = ?', Number(id));
  if (row) {
    return JSON.parse(row.data) as ClinicSummary;
  }
  const home = await getCachedHome();
  return home?.value.featuredClinics.find((clinic) => clinic.id === Number(id)) ?? null;
};

// ---------------------------------------------------------------------------
// Clinic details
// ---------------------------------------------------------------------------

/**
 * Best local version of a clinic: the saved details (with reviews) if the clinic was
 * opened online before, otherwise its directory entry with `reviews: null`.
 */
export const getCachedClinicDetails = async (
  id: number | string,
): Promise<{ clinic: ClinicSummary; reviews: ClinicReview[] | null; updatedAt: number | null } | null> => {
  const cached = await readCache<ClinicDetails>(KEYS.clinicDetails(id));
  if (cached) {
    return { clinic: cached.value, reviews: cached.value.reviews, updatedAt: cached.updatedAt };
  }
  const summary = await getClinicSummary(id);
  return summary ? { clinic: summary, reviews: null, updatedAt: null } : null;
};

export const fetchClinicDetails = async (id: number | string): Promise<ClinicDetails> => {
  const response = await api.get(`/clinics/${id}`);
  const details = normalizeClinicDetails(response.data?.data ?? {});
  await writeCache(KEYS.clinicDetails(id), details);
  return details;
};

// ---------------------------------------------------------------------------
// Full refresh
// ---------------------------------------------------------------------------

export const getLastPublicSync = async (): Promise<number | null> => {
  const entry = await readCache<number>(KEYS.lastSync);
  return entry?.value ?? null;
};

/** Refreshes everything the guest pages need. Throws only if every part failed. */
export const syncPublicData = async (): Promise<void> => {
  const results = await Promise.allSettled([
    fetchHome(),
    syncClinicDirectory(),
    fetchSpecializations(),
  ]);
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failures.length === results.length) {
    throw failures[0].reason;
  }
  failures.forEach((failure) => console.warn('[offline] partial public sync failure', failure.reason));
  await writeCache(KEYS.lastSync, Date.now());
};
