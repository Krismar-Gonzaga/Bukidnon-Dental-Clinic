import PortalLayout from './PortalLayout';
import {
  PATIENT_NAV_ITEMS,
  PATIENT_NOTIFICATIONS_HREF,
} from '../config/patientNavigation';

// Patient portal frame: fixed sidebar with account summary and navigation,
// plus a top bar with the page title, notifications, and avatar. The signed-in
// user and unread count come from the session (see PortalLayout).
function PatientLayout({ title, activeHref, children }) {
  return (
    <PortalLayout
      title={title}
      navItems={PATIENT_NAV_ITEMS}
      activeHref={activeHref}
      roleLabel="Patient"
      notificationsHref={PATIENT_NOTIFICATIONS_HREF}
      navLabel="Patient"
    >
      {children}
    </PortalLayout>
  );
}

export default PatientLayout;
