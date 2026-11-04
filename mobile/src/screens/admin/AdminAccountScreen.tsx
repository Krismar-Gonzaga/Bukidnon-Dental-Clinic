// My Profile for system administrators (web: pages/admin/AdminProfilePage.jsx): details,
// password with two-factor and devices, and the alerts they want.
import React, { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { AccountSecurity } from '../../components/AccountSecurity';
import { Card, Chips, FormError, LoadState, Toggle, ui, useLoader } from '../../components/clinic/ClinicUi';
import { useAuth } from '../../context/AuthContext';
import { serverMessage } from '../../services/clinicPortal';
import { fetchNotificationPreferences, updateNotificationPreferences } from '../../services/notifications';
import { PasswordForm, ProfileForm } from '../clinic/ClinicAccountScreen';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'notifications', label: 'Notifications' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const PREFERENCES = [
  { key: 'admin_new_clinic_registrations', label: 'New Clinic Registrations', hint: 'Alert when a new clinic registers' },
  { key: 'admin_verification_requests', label: 'Verification Requests', hint: 'Alert on new verification submissions' },
  { key: 'admin_payment_submissions', label: 'Payment Submissions', hint: 'Alert when proof of payment is submitted' },
  { key: 'admin_system_alerts', label: 'System Errors & Alerts', hint: 'Critical platform alerts' },
];

function NotificationSwitches() {
  const preferences = useLoader(fetchNotificationPreferences, [], 'Your preferences could not be loaded.');
  const [categories, setCategories] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preferences.data && !categories) setCategories(preferences.data.categories ?? {});
  }, [preferences.data, categories]);

  const change = async (key: string, value: boolean) => {
    const before = categories;
    setCategories({ ...categories, [key]: value });
    setError(null);
    try {
      await updateNotificationPreferences({ categories: { [key]: value } });
    } catch (err) {
      setCategories(before);
      setError(serverMessage(err, 'Your choice could not be saved.'));
    }
  };

  return (
    <Card title="Notification Preferences">
      {!categories ? (
        <LoadState loading={preferences.loading} error={preferences.error} onRetry={preferences.reload} />
      ) : (
        PREFERENCES.map((item) => <Toggle key={item.key} label={item.label} hint={item.hint} value={categories[item.key] !== false} onChange={(value) => change(item.key, value)} />)
      )}
      <FormError message={error} />
    </Card>
  );
}

const AdminAccountScreen = ({ route }: { route?: { params?: { tab?: TabId } } }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>(route?.params?.tab ?? 'profile');

  return (
    <AdminScreen title="My Profile" active="AdminAccount" back>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Card title={user?.name ?? ''} subtitle="System Administrator">
          <Text style={ui.small}>System Admin · Active</Text>
        </Card>
        <Chips options={[...TABS]} value={tab} onChange={setTab} />
        {tab === 'profile' && <ProfileForm withPhone />}
        {tab === 'security' && (
          <>
            <PasswordForm />
            <AccountSecurity />
          </>
        )}
        {tab === 'notifications' && <NotificationSwitches />}
      </ScrollView>
    </AdminScreen>
  );
};

export default AdminAccountScreen;
