import apiClient, { getData } from './apiClient';
import { toAppointment, toClinicSummary, toReview } from './adapters';
import { formatDate } from '../utils/dateTime';

// The signed-in patient's own data.

export async function getPatientDashboard() {
  const data = await getData('/patient/dashboard');
  return {
    name: data.name,
    upcoming: data.upcoming.map(toAppointment),
    counts: data.counts,
    unreadNotifications: data.unread_notifications,
  };
}

export async function getAppointments() {
  return (await getData('/patient/appointments')).map(toAppointment);
}

export async function getAppointment(id) {
  return toAppointment(await getData(`/patient/appointments/${id}`));
}

/**
 * Request an appointment. idempotencyKey: one value per booking attempt so a
 * retried request (double click, flaky network) cannot create two bookings.
 */
export async function bookAppointment({ clinicId, serviceRateId, dentistId, branchId, startsAt, reason }, idempotencyKey) {
  const { data } = await apiClient.post(
    '/patient/appointments',
    {
      clinic_id: Number(clinicId),
      service_rate_id: Number(serviceRateId),
      dentist_id: Number(dentistId),
      branch_id: Number(branchId),
      starts_at: startsAt,
      reason: reason || undefined,
    },
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return toAppointment(data.data);
}

export async function rescheduleAppointment(id, startsAt) {
  const { data } = await apiClient.put(`/patient/appointments/${id}`, { starts_at: startsAt });
  return { appointment: toAppointment(data.data), message: data.message };
}

export async function cancelAppointment(id, reason) {
  await apiClient.post(`/patient/appointments/${id}/cancel`, { reason: reason || undefined });
}

export async function getReviewableAppointments() {
  return (await getData('/patient/reviews/eligible')).map(toAppointment);
}

export async function getMyReviews() {
  return (await getData('/patient/reviews')).map(toReview);
}

export async function submitReview(appointmentId, { rating, comment }) {
  const { data } = await apiClient.post(`/patient/appointments/${appointmentId}/review`, {
    rating,
    comment: comment || undefined,
  });
  return toReview(data.data);
}

export async function getSavedClinics() {
  return (await getData('/patient/saved-clinics')).map(toClinicSummary);
}

export const saveClinic = (clinicId) => apiClient.put(`/patient/saved-clinics/${clinicId}`);
export const unsaveClinic = (clinicId) => apiClient.delete(`/patient/saved-clinics/${clinicId}`);

const GENDER_LABEL = { male: 'Male', female: 'Female', other: 'Other' };

export async function getProfile() {
  const p = await getData('/patient/profile');
  return {
    name: p.name,
    email: p.email,
    phone: p.phone ?? '',
    address: p.address ?? '',
    birthDate: p.birth_date ?? '',
    gender: GENDER_LABEL[p.gender] ?? '',
    emergencyContactName: p.emergency_contact_name ?? '',
    emergencyContactPhone: p.emergency_contact_phone ?? '',
    emailNotifications: p.notification_preferences?.email !== false,
  };
}

export async function updateProfile(form) {
  const { data } = await apiClient.put('/patient/profile', {
    name: form.name,
    email: form.email,
    phone: form.phone,
    address: form.address,
    birth_date: form.birthDate || null,
    gender: form.gender ? form.gender.toLowerCase() : null,
    emergency_contact_name: form.emergencyContactName || null,
    emergency_contact_phone: form.emergencyContactPhone || null,
  });
  return data.data;
}

/** Records a clinic shared with the patient (procedures and care instructions). */
export async function getSharedRecords() {
  return (await getData('/patient/records')).map((r) => ({
    id: String(r.id),
    clinic: r.clinic,
    dentist: r.dentist,
    type: r.record_type,
    procedures: r.procedures ?? '',
    careInstructions: r.care_instructions ?? '',
    date: r.date ? formatDate(r.date) : '',
  }));
}

/** Allergies, medications and conditions as last recorded by each clinic. */
export async function getMedicalHistory() {
  return (await getData('/patient/medical-history')).map((entry) => ({
    clinic: entry.clinic,
    allergies: entry.allergies ?? '',
    medications: entry.medications ?? '',
    conditions: entry.conditions ?? '',
    recordedAt: entry.recorded_at ? formatDate(entry.recorded_at) : '',
  }));
}
