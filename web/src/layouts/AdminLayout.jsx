import PortalLayout from './PortalLayout';
import { ADMIN_NAV_ITEMS, ADMIN_NOTIFICATIONS_HREF } from '../config/adminNavigation';
import '../components/portal/portal.css';

function AdminLayout({ title, activeHref, children }) {
  return (
    <PortalLayout
      title={title}
      navItems={ADMIN_NAV_ITEMS}
      activeHref={activeHref}
      roleLabel="System Administrator"
      notificationsHref={ADMIN_NOTIFICATIONS_HREF}
      navLabel="Administration"
    >
      {children}
    </PortalLayout>
  );
}

export default AdminLayout;
