// My Profile and Change Password for system administrators (web:
// AccountProfilePage / ChangePasswordPage in the admin layout). The forms
// are shared with the clinic portal.
import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { Chips, ui } from '../../components/clinic/ClinicUi';
import { PasswordForm, ProfileForm, Tab, TABS } from '../clinic/ClinicAccountScreen';

const AdminAccountScreen = ({ route }: { route?: { params?: { tab?: Tab } } }) => {
  const [tab, setTab] = useState<Tab>(route?.params?.tab ?? 'profile');

  return (
    <AdminScreen title={tab === 'profile' ? 'My Profile' : 'Change Password'} active="AdminAccount" back>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Chips options={TABS} value={tab} onChange={setTab} />
        {tab === 'profile' ? <ProfileForm /> : <PasswordForm />}
      </ScrollView>
    </AdminScreen>
  );
};

export default AdminAccountScreen;
