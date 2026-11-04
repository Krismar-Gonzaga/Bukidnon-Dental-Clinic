import PortalLayout from './PortalLayout';
import { useAuth } from '../auth/AuthContext';
import { CLINIC_APPLY_HREF, CLINIC_PORTAL_HREF } from '../config/clinicNavigation';
import '../components/portal/portal.css';

/** Frame for clinic owners working on an application (before approval). */
function ClinicApplicantLayout({ title, activeHref, children }) {
  const { memberships } = useAuth();
  const navItems = [
    { label: 'Clinic application', href: CLINIC_APPLY_HREF, icon: 'shieldCheck' },
    ...(memberships.length > 0 ? [{ label: 'My clinics', href: CLINIC_PORTAL_HREF, icon: 'building' }] : []),
  ];

  return (
    <PortalLayout title={title} navItems={navItems} activeHref={activeHref} roleLabel="Clinic Admin" navLabel="Clinic owner">
      {children}
    </PortalLayout>
  );
}

export default ClinicApplicantLayout;
