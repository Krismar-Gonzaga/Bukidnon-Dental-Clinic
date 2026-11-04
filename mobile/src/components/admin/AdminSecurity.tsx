// Password re-confirmation for high-impact administration (web:
// components/admin/AdminSecurity.jsx). `run(call)` runs an API call; when the
// server answers 423 it shows the password prompt, confirms the password and
// runs the call once more. Cancelling rejects with CANCELLED_MESSAGE.
//
// Phones cannot show a second modal over an open sheet, so the prompt is
// placed by the screen: `<PasswordPrompt sensitive={s} inline />` inside the
// sheet the action came from, or `<PasswordPrompt sensitive={s} />` (its own
// sheet) for actions started outside one.
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Field, FormError, Sheet, ui } from '../clinic/ClinicUi';
import { confirmAdminPassword, needsPasswordConfirmation } from '../../services/admin';
import { serverMessage } from '../../services/clinicPortal';
import { palette, radius, spacing } from '../../theme/tokens';

export const CANCELLED_MESSAGE = 'Not done: your password was not confirmed.';

/** Error text for a failed admin action, including a cancelled password check. */
export const actionError = (err: any, fallback: string) => (err?.isCancelled ? CANCELLED_MESSAGE : serverMessage(err, fallback));

export type Sensitive = {
  run: <T>(call: () => Promise<T>) => Promise<T>;
  asking: boolean;
  settle: (confirmed: boolean) => void;
};

export function useSensitiveAction(): Sensitive {
  const [asking, setAsking] = useState(false);
  const pending = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    const request = pending.current;
    pending.current = null;
    setAsking(false);
    if (confirmed) request?.resolve();
    else request?.reject(Object.assign(new Error(CANCELLED_MESSAGE), { isCancelled: true }));
  }, []);

  const run = useCallback(async <T,>(call: () => Promise<T>): Promise<T> => {
    try {
      return await call();
    } catch (error) {
      if (!needsPasswordConfirmation(error)) throw error;
      await new Promise<void>((resolve, reject) => {
        pending.current = { resolve, reject };
        setAsking(true);
      });
      return call();
    }
  }, []) as Sensitive['run'];

  return { run, asking, settle };
}

function PasswordPanel({ onConfirmed, onCancel }: { onConfirmed: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmAdminPassword(password);
      setPassword('');
      onConfirmed();
    } catch (err) {
      setError(serverMessage(err, 'Your password could not be checked.'));
      setPassword('');
      setBusy(false);
    }
  };

  return (
    <View style={styles.panel} accessibilityLabel="Confirm your password">
      <Text style={ui.title}>Confirm your password</Text>
      <Text style={ui.muted}>
        This action changes what clinics or people can do on the platform. You will not be asked again for 15 minutes on this device.
      </Text>
      <Field label="Password" required secureTextEntry autoCapitalize="none" maxLength={255} value={password} onChangeText={setPassword} />
      <FormError message={error} />
      <View style={ui.rowWrap}>
        <Button label="Confirm" small busy={busy} disabled={!password} onPress={submit} />
        <Button label="Cancel" small variant="outline" disabled={busy} onPress={onCancel} />
      </View>
    </View>
  );
}

export function PasswordPrompt({ sensitive, inline = false }: { sensitive: Sensitive; inline?: boolean }) {
  if (!sensitive.asking) return null;
  const panel = <PasswordPanel onConfirmed={() => sensitive.settle(true)} onCancel={() => sensitive.settle(false)} />;
  return inline ? (
    panel
  ) : (
    <Sheet title="Confirm your password" onClose={() => sensitive.settle(false)}>
      {panel}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.surfaceContainerLow,
  },
});
