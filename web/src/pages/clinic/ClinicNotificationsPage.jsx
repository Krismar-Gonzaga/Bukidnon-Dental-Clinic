import ClinicLayout from '../../layouts/ClinicLayout';
import NotificationList from '../../components/NotificationList';

function ClinicNotificationsPage() {
  return (
    <ClinicLayout section="notifications" title="Notifications">
      <NotificationList />
    </ClinicLayout>
  );
}

export default ClinicNotificationsPage;
