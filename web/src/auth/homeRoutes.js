import { PATIENT_DASHBOARD_HREF } from '../config/patientNavigation';
import { ADMIN_DASHBOARD_HREF } from '../config/adminNavigation';
import { CLINIC_APPLY_HREF, CLINIC_PORTAL_HREF } from '../config/clinicNavigation';

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

/** Only same-site paths are honoured for ?next= (no open redirects). */
export function safeNextPath(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : null;
}
