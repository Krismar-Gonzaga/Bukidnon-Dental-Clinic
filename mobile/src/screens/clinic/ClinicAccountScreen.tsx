// My Profile and Change Password for clinic members (web: AccountProfilePage,
// opened from the avatar menu). Changing the password signs out other devices.
import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Button, Card, Chips, Field, FormError, InfoRow, ui } from '../../components/clinic/ClinicUi';
import { useAuth } from '../../context/AuthContext';
import { changePassword, CLINIC_ROLE_LABELS, serverMessage, updateAccount } from '../../services/clinicPortal';

export type Tab = 'profile' | 'password';
export const TABS = [
  { id: 'profile' as Tab, label: 'My Profile' },
  { id: 'password' as Tab, label: 'Change Password' },
];

/** Shared with the system admin account page (screens/admin/AdminAccountScreen). */
export function ProfileForm() {
  const { user, updateUser } = useAuth();
  const { memberships } = useClinicPortal();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(String(user?.email ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateAccount({ name: name.trim(), email: email.trim() });
      updateUser({ name: name.trim(), email: email.trim() });
      setSaved(true);
    } catch (err) {
      setError(serverMessage(err, 'Your profile could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card title="My Profile" subtitle="Your name and sign-in email.">
        <Field label="Full name" required autoCapitalize="words" value={name} onChangeText={setName} />
        <Field label="Email" required keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <FormError message={error} />
        {saved && <Text style={ui.success}>Profile saved.</Text>}
        <Button label="Save profile" style={ui.spacedTop} busy={busy} disabled={!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())} onPress={save} />
      </Card>
      {memberships.length > 0 && (
        <Card title="Clinic access">
          {memberships.map((m) => (
            <InfoRow key={m.clinic_id} label={m.clinic_name} value={CLINIC_ROLE_LABELS[m.role] ?? m.role} />
          ))}
          <Text style={ui.small}>Roles are managed by your clinic administrator.</Text>
        </Card>
      )}
    </>
  );
}

export function PasswordForm() {
  const [form, setForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const bind = (name: keyof typeof form) => ({
    value: form[name],
    onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })),
    secureTextEntry: true,
    autoCapitalize: 'none' as const,
  });
  const mismatch = form.new_password_confirmation !== '' && form.new_password !== form.new_password_confirmation;

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await changePassword(form);
      setForm({ current_password: '', new_password: '', new_password_confirmation: '' });
      setSaved(true);
    } catch (err) {
      setError(serverMessage(err, 'Your password could not be changed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Change Password" subtitle="At least 8 characters with letters and numbers. Other devices are signed out.">
      <Field label="Current password" required {...bind('current_password')} />
      <Field label="New password" required {...bind('new_password')} />
      <Field label="Confirm new password" required {...bind('new_password_confirmation')} />
      {mismatch && <FormError message="The new passwords do not match." />}
      <FormError message={error} />
      {saved && <Text style={ui.success}>Password changed.</Text>}
      <Button
        label="Change password"
        style={ui.spacedTop}
        busy={busy}
        disabled={!form.current_password || form.new_password.length < 8 || mismatch || !form.new_password_confirmation}
        onPress={save}
      />
    </Card>
  );
}

const ClinicAccountScreen = ({ route }: { route?: { params?: { tab?: Tab } } }) => {
  const [tab, setTab] = useState<Tab>(route?.params?.tab ?? 'profile');
  React.useEffect(() => {
    if (route?.params?.tab) setTab(route.params.tab);
  }, [route?.params?.tab]);

  return (
    <ClinicScreen title={tab === 'profile' ? 'My Profile' : 'Change Password'} active="ClinicAccount" back>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Chips options={TABS} value={tab} onChange={setTab} />
        {tab === 'profile' ? <ProfileForm /> : <PasswordForm />}
      </ScrollView>
    </ClinicScreen>
  );
};

export default ClinicAccountScreen;
