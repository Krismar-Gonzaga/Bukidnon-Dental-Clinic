import { PATIENT_DASHBOARD_HREF, PATIENT_PROFILE_HREF } from '../config/patientNavigation';
import { ADMIN_DASHBOARD_HREF, ADMIN_PROFILE_HREF } from '../config/adminNavigation';
import {
  CLINIC_APPLICANT_PROFILE_HREF,
  CLINIC_APPLY_HREF,
  CLINIC_PORTAL_HREF,
  getClinicHref,
} from '../config/clinicNavigation';

/**
 * Where a signed-in user lands. Clinic access comes from active memberships
 * (returned by GET /api/user), not from the account type alone.
 */
export function getHomeHref(user) {
  if (!user) return '/';
  if (user.role === 'system_admin') return ADMIN_DASHBOARD_HREF;
  if (user.role === 'patient') return PATIENT_DASHBOARD_HREF;
  if ((user.memberships ?? []).length > 0) return CLINIC_PORTAL_HREF;
  if (user.role === 'clinic_admin') return CLINIC_APPLY_HREF;
  return CLINIC_PORTAL_HREF;
}

/**
 * The "My Profile" page for the header avatar menu. Clinic members get the
 * page inside the given clinic (or their first clinic).
 */
export function getProfileHref(user, clinicId) {
  if (!user) return null;
  if (user.role === 'patient') return PATIENT_PROFILE_HREF;
  if (user.role === 'system_admin') return ADMIN_PROFILE_HREF;
  const memberClinicId = clinicId ?? user.memberships?.[0]?.clinic_id;
  if (memberClinicId != null) return getClinicHref(memberClinicId, 'profile');
  if (user.role === 'clinic_admin') return CLINIC_APPLICANT_PROFILE_HREF;
  return null;
}

/** Only same-site paths are honoured for ?next= (no open redirects). */
export function safeNextPath(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : null;
}
