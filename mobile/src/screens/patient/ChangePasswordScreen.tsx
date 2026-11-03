// Change the account password. The server signs out every other device afterwards.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import PatientShell from '../../components/patient/PatientShell';
import { BackLink, Notice, SuccessCard } from '../../components/patient/PatientUi';
import { Card, guestColors, PrimaryButton } from '../../components/guest/GuestUi';
import { changePassword, passwordStrength } from '../../services/patientPortal';
import { spacing, type } from '../../theme/tokens';
import { serverMessage } from './BookAppointmentScreen';

const SEGMENTS = 4;
const TONES: Record<string, string> = { Weak: '#ef3b3b', Medium: '#f5843c', Good: '#22a35a', Strong: '#22a35a' };

const PasswordField = ({ label, value, onChange }: { label: string; value: string; onChange: (text: string) => void }) => {
  const [shown, setShown] = useState(false);
  return (
    <View>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.field}>
        <Icon name="lock-closed-outline" size={16} color={guestColors.textMuted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!shown}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
        />
        <TouchableOpacity onPress={() => setShown(!shown)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${shown ? 'Hide' : 'Show'} ${label.toLowerCase()}`}>
          <Icon name={shown ? 'eye-off-outline' : 'eye-outline'} size={18} color={guestColors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ChangePasswordScreen = ({ navigation }: { navigation: any }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const strength = passwordStrength(next);

  const submit = async () => {
    if (next !== confirmation) {
      setProblem('The new passwords do not match.');
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirmation('');
      setDone(true);
    } catch (error) {
      setProblem(serverMessage(error, 'Your password could not be changed.'));
    } finally {
      setSaving(false);
    }
  };

  const back = () => navigation.popTo('Profile');

  return (
    <PatientShell navigation={navigation} title="Change Password" active="Profile">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackLink label="Back to Profile" onPress={back} />
          {done ? (
            <SuccessCard title="Password Changed!" message="Your password has been updated successfully." actionLabel="Back to Profile" onAction={back} />
          ) : (
            <Card>
              <View style={styles.icon}>
                <Icon name="lock-closed-outline" size={26} color={guestColors.primary} />
              </View>
              <Text style={styles.title} accessibilityRole="header">
                Change Password
              </Text>
              <View style={styles.stack}>
                <PasswordField label="Current Password" value={current} onChange={setCurrent} />
                <PasswordField label="New Password" value={next} onChange={setNext} />
                <PasswordField label="Confirm New Password" value={confirmation} onChange={setConfirmation} />
                {next.length > 0 && (
                  <View>
                    <Text style={styles.strengthTitle}>Password strength:</Text>
                    <View style={styles.bar}>
                      {Array.from({ length: SEGMENTS }, (_, index) => (
                        <View key={index} style={[styles.segment, index < strength.score && { backgroundColor: TONES[strength.label] }]} />
                      ))}
                    </View>
                    <Text style={[styles.strengthText, { color: TONES[strength.label] }]}>
                      {strength.label}
                      {strength.hint ? ` — ${strength.hint}` : ''}
                    </Text>
                  </View>
                )}
                {problem && <Notice tone="danger">{problem}</Notice>}
                <PrimaryButton label={saving ? 'Updating…' : 'Update Password'} onPress={submit} disabled={!current || !next || !confirmation} busy={saving} />
              </View>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </PatientShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.marginMobile, paddingBottom: spacing.xl },
  icon: { alignSelf: 'center', width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d7e2ff', marginBottom: spacing.sm },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: guestColors.text, textAlign: 'center', marginBottom: spacing.md },
  stack: { gap: spacing.md },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0.6, color: guestColors.text, marginBottom: spacing.base },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, minHeight: 46, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: guestColors.border, borderRadius: 10, backgroundColor: guestColors.surface },
  input: { ...type.bodyMd, flex: 1, color: guestColors.text, paddingVertical: spacing.base },
  strengthTitle: { fontSize: 13, lineHeight: 18, color: guestColors.textMuted, marginBottom: spacing.xs },
  bar: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: guestColors.border },
  strengthText: { fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
});

export default ChangePasswordScreen;
