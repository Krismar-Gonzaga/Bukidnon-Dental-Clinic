// src/screens/auth/StaffNoticeScreen.tsx
// Signed-in accounts the mobile app has no screens for: clinic owners whose
// clinic is not approved yet (no clinic membership). Members of an approved
// clinic get the clinic portal (screens/clinic/) and system administrators
// the admin portal (screens/admin/).
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { confirmLogout } from '../../utils/confirmLogout';

const StaffNoticeScreen = ({ navigation }: { navigation: any }) => {
  const { user, logout } = useAuth();
  const isClinicOwner = user?.role === 'clinic_admin';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.card}>
        <Icon name="desktop-outline" size={48} color="#003f87" />
        <Text style={styles.title}>Use the web portal</Text>
        <Text style={styles.body}>
          Signed in as {user?.name ?? 'a clinic account'}. Clinic, staff and administrator tools are
          available in the Bukidnon Dental Portal website. This app is for patients booking and
          managing their own appointments.
        </Text>
        {isClinicOwner && (
          <>
            <Text style={styles.body}>
              Your clinic application and its documents can be completed and tracked from the website.
              You can also upload your verification documents here.
            </Text>
            <TouchableOpacity
              style={styles.secondary}
              onPress={() => navigation.navigate('ClinicRequirements')}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Upload clinic documents</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          style={styles.primary}
          onPress={() => confirmLogout(0, () => logout())}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9ff', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a202c' },
  body: { fontSize: 15, color: '#4a5568', textAlign: 'center', lineHeight: 22 },
  primary: {
    backgroundColor: '#003f87',
    borderRadius: 12,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: {
    borderColor: '#003f87',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  secondaryText: { color: '#003f87', fontSize: 16, fontWeight: '600' },
});

export default StaffNoticeScreen;
