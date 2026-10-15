import AdminLayout from '../../layouts/AdminLayout';
import NotificationList from '../../components/NotificationList';
import { ADMIN_NOTIFICATIONS_HREF } from '../../config/adminNavigation';

function AdminNotificationsPage() {
  return (
    <AdminLayout title="Notifications" activeHref={ADMIN_NOTIFICATIONS_HREF}>
      <NotificationList />
    </AdminLayout>
  );
}

export default AdminNotificationsPage;
