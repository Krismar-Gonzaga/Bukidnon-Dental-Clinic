import PatientLayout from '../layouts/PatientLayout';
import NotificationList from '../components/NotificationList';
import { PATIENT_NOTIFICATIONS_HREF } from '../config/patientNavigation';

function NotificationsPage() {
  return (
    <PatientLayout title="Notifications" activeHref={PATIENT_NOTIFICATIONS_HREF}>
      <NotificationList />
    </PatientLayout>
  );
}

export default NotificationsPage;
