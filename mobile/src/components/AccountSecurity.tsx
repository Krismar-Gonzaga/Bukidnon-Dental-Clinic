// Two-factor sign-in and signed-in devices (web: components/security/AccountSecurity),
// shown on the security page of every kind of account.
import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { NoteBox } from './clinic/ClinicAdminKit';
import { Button, Card, Field, FormError, LoadState, Sheet, Toggle, ui, useLoader } from './clinic/ClinicUi';
import { useAuth } from '../context/AuthContext';
import { confirmTwoFactor, disableTwoFactor, formatDateTime, serverMessage, startTwoFactorSetup, TwoFactorSetup } from '../services/clinicPortal';
import { DeviceSession, fetchSessions, fetchTwoFactorStatus, regenerateRecoveryCodes, revokeSession, signOutOtherSessions } from '../services/dentistPortal';
import { palette, radius, spacing } from '../theme/tokens';

function useAttempt() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = async (work: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(serverMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, attempt };
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <>
      <NoteBox>Save these recovery codes somewhere safe. Each one works once if you lose your authenticator app, and they are shown only now.</NoteBox>
      {codes.map((item) => (
        <Text key={item} selectable style={styles.code}>
          {item}
        </Text>
      ))}
      <Button label="I saved them" style={ui.spacedTop} onPress={onDone} />
    </>
  );
}

export function TwoFactorCard() {
  const { user, updateUser } = useAuth();
  const enabled = Boolean((user as { two_factor_enabled?: boolean } | null)?.two_factor_enabled);
  const [mode, setMode] = useState<'setup' | 'disable' | 'codes' | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const { busy, error, setError, attempt } = useAttempt();
  const status = useLoader(() => (enabled ? fetchTwoFactorStatus() : Promise.resolve(null)), [enabled], 'Could not check your recovery codes.');

  const close = () => {
    setMode(null);
    setPassword('');
    setCode('');
    setSetup(null);
    setRecoveryCodes(null);
    setError(null);
    status.sync();
  };

  return (
    <Card>
      <Toggle label="Two-Factor Authentication" hint="Add an extra layer of security to your account using an authenticator app." value={enabled} onChange={(value) => setMode(value ? 'setup' : 'disable')} />
      {enabled && (
        <>
          <NoteBox tone="info">2FA is enabled. Your account is protected.</NoteBox>
          {status.data && <Text style={ui.small}>{status.data.recovery_codes_left} recovery codes left</Text>}
          <Button small variant="outline" label="Create new recovery codes" style={ui.spacedTop} onPress={() => setMode('codes')} />
        </>
      )}

      {mode === 'setup' && (
        <Sheet title="Set Up Two-Factor Authentication" onClose={close}>
          {recoveryCodes ? (
            <RecoveryCodes codes={recoveryCodes} onDone={close} />
          ) : setup ? (
            <>
              <Text style={ui.muted}>Add this key to your authenticator app (Google Authenticator, Microsoft Authenticator or similar), then enter the 6-digit code it shows.</Text>
              <Text selectable style={styles.code}>
                {setup.secret}
              </Text>
              <Button small variant="outline" label="Open in authenticator app" onPress={() => Linking.openURL(setup.otpauth_url)} />
              <Field label="6-digit code" required keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
              <FormError message={error} />
              <Button
                label="Enable 2FA"
                style={ui.spacedTop}
                busy={busy}
                disabled={!code.trim()}
                onPress={() =>
                  attempt(async () => {
                    const result = await confirmTwoFactor(code.trim());
                    setRecoveryCodes(result.recovery_codes ?? []);
                    updateUser({ two_factor_enabled: true } as never);
                  }, 'That code was not accepted.')
                }
              />
            </>
          ) : (
            <>
              <Field label="Confirm your password" required secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} />
              <FormError message={error} />
              <Button
                label="Continue"
                style={ui.spacedTop}
                busy={busy}
                disabled={!password}
                onPress={() =>
                  attempt(async () => {
                    setSetup(await startTwoFactorSetup(password));
                    setPassword('');
                  }, 'Your password could not be confirmed.')
                }
              />
            </>
          )}
        </Sheet>
      )}

      {mode === 'disable' && (
        <Sheet title="Turn Off Two-Factor Authentication" onClose={close}>
          <Text style={ui.muted}>Your account will be protected by your password only.</Text>
          <Field label="Confirm your password" required secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} />
          <Field label="Code from your app, or a recovery code" required autoCapitalize="none" maxLength={20} value={code} onChangeText={setCode} />
          <FormError message={error} />
          <Button
            label="Turn Off"
            variant="danger"
            style={ui.spacedTop}
            busy={busy}
            disabled={!password || !code.trim()}
            onPress={() =>
              attempt(async () => {
                await disableTwoFactor(password, code.trim());
                updateUser({ two_factor_enabled: false } as never);
                close();
              }, 'Two-factor sign-in could not be turned off.')
            }
          />
        </Sheet>
      )}

      {mode === 'codes' && (
        <Sheet title="New Recovery Codes" onClose={close}>
          {recoveryCodes ? (
            <RecoveryCodes codes={recoveryCodes} onDone={close} />
          ) : (
            <>
              <Text style={ui.muted}>Your old recovery codes will stop working.</Text>
              <Field label="Confirm your password" required secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} />
              <FormError message={error} />
              <Button
                label="Create New Codes"
                style={ui.spacedTop}
                busy={busy}
                disabled={!password}
                onPress={() =>
                  attempt(async () => {
                    const result = await regenerateRecoveryCodes(password);
                    setRecoveryCodes(result.recovery_codes ?? []);
                    setPassword('');
                  }, 'New recovery codes could not be created.')
                }
              />
            </>
          )}
        </Sheet>
      )}
    </Card>
  );
}

export function SessionsCard() {
  const list = useLoader(fetchSessions, [], 'Your devices could not be loaded.');
  const [asking, setAsking] = useState<DeviceSession | null>(null);
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);
  const [password, setPassword] = useState('');
  const { busy, error, setError, attempt } = useAttempt();
  const sessions = list.data ?? [];

  const close = () => {
    setAsking(null);
    setIsSigningOutOthers(false);
    setPassword('');
    setError(null);
  };

  return (
    <Card title="Signed-in Devices" subtitle="Sign out of anything you do not recognize, then change your password.">
      <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
      {sessions.map((session) => (
        <View key={session.id} style={styles.session}>
          <Icon name={session.type === 'app' ? 'phone-portrait-outline' : 'desktop-outline'} size={20} color={palette.primary} />
          <View style={ui.flex}>
            <Text style={styles.device}>
              {session.device}
              {session.current ? ' (this device)' : ''}
            </Text>
            <Text style={ui.small}>{[session.type === 'app' ? 'Mobile app' : 'Web browser', session.ip_address, `Active ${formatDateTime(session.last_active_at)}`].filter(Boolean).join(' · ')}</Text>
          </View>
          {!session.current && <Button small variant="outline" label="Sign out" onPress={() => setAsking(session)} />}
        </View>
      ))}
      {sessions.some((session) => !session.current) && <Button small variant="outline" label="Sign out of all others" style={ui.spacedTop} onPress={() => setIsSigningOutOthers(true)} />}

      {asking && (
        <Sheet title="Sign out of this device?" onClose={close}>
          <Text style={ui.muted}>{asking.device} will need to sign in again.</Text>
          <FormError message={error} />
          <Button
            label="Sign out"
            variant="danger"
            style={ui.spacedTop}
            busy={busy}
            onPress={() =>
              attempt(async () => {
                await revokeSession(asking.id);
                close();
                list.sync();
              }, 'That device could not be signed out.')
            }
          />
        </Sheet>
      )}

      {isSigningOutOthers && (
        <Sheet title="Sign Out of Other Devices" onClose={close}>
          <Text style={ui.muted}>Every device except this one will need to sign in again.</Text>
          <Field label="Confirm your password" required secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} />
          <FormError message={error} />
          <Button
            label="Sign Out"
            variant="danger"
            style={ui.spacedTop}
            busy={busy}
            disabled={!password}
            onPress={() =>
              attempt(async () => {
                await signOutOtherSessions(password);
                close();
                list.sync();
              }, 'Other devices could not be signed out.')
            }
          />
        </Sheet>
      )}
    </Card>
  );
}

export function AccountSecurity() {
  return (
    <>
      <TwoFactorCard />
      <SessionsCard />
    </>
  );
}

const styles = StyleSheet.create({
  code: { marginVertical: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLow, color: palette.onSurface, fontFamily: 'monospace', textAlign: 'center' },
  session: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: palette.surfaceContainerHigh },
  device: { fontSize: 14, fontWeight: '600', color: palette.onSurface },
});
