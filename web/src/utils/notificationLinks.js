import { getAppointmentDetailsHref } from '../config/patientNavigation';
import { getAdminApplicationHref, getAdminSubscriptionHref } from '../config/adminNavigation';
import { CLINIC_APPLY_HREF, CLINIC_PORTAL_HREF, getClinicHref } from '../config/clinicNavigation';

/**
 * Page a notification is about, from its `resource` hint (set by the API),
 * or null when there is no specific page. `user` decides between the
 * patient, clinic and admin versions.
 */
export function getNotificationHref(notification, user) {
  const { type, id, clinic_id: clinicId } = notification?.resource ?? {};
  if (!type) return null;

  switch (type) {
    case 'appointment':
      return user?.role === 'patient' && id ? getAppointmentDetailsHref(id) : null;
    case 'clinic_appointment':
      return clinicId && id ? `${getClinicHref(clinicId, 'appointments')}/${encodeURIComponent(id)}` : null;
    case 'clinic_dentist':
      return clinicId && id ? `${getClinicHref(clinicId, 'dentists')}/${encodeURIComponent(id)}` : null;
    case 'dentist_schedule':
      return clinicId ? getClinicHref(clinicId, 'my-schedule') : null;
    case 'clinic_patient':
      return clinicId && id ? `${getClinicHref(clinicId, 'patients')}/${encodeURIComponent(id)}` : null;
    case 'inventory_alerts':
      return clinicId ? getClinicHref(clinicId, 'inventory') : null;
    case 'clinic_application':
      if (user?.role === 'system_admin') return id ? getAdminApplicationHref(id) : null;
      return CLINIC_APPLY_HREF;
    case 'subscription_payment':
      return user?.role === 'system_admin' && clinicId ? getAdminSubscriptionHref(clinicId) : null;
    case 'clinic_membership':
      return CLINIC_PORTAL_HREF;
    default:
      return null;
  }
}
