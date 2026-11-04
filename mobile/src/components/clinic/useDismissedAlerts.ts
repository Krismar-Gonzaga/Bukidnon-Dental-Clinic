// Dashboard alerts this person chose to hide ("Ignore", "Mark all as read"),
// as on the web. Alerts are worked out live from clinic data, so hiding one
// is a per-device preference; it never changes clinic data. The key includes
// the message, so an alert whose details change (stock drops further) shows again.
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClinicAlert } from '../../services/clinicPortal';

const MAX_KEYS = 200;

export const alertKey = (alert: ClinicAlert) => `${alert.type}|${alert.title}|${alert.message}`;

export function useDismissedAlerts(storageKey: string) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        const saved = JSON.parse(raw ?? '[]');
        if (!cancelled) setDismissed(new Set(Array.isArray(saved) ? saved : []));
      })
      .catch(() => !cancelled && setDismissed(new Set()));
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const save = useCallback(
    (next: Set<string>) => {
      setDismissed(next);
      AsyncStorage.setItem(storageKey, JSON.stringify([...next].slice(-MAX_KEYS))).catch(() => undefined);
    },
    [storageKey],
  );

  return {
    isDismissed: (key: string) => dismissed.has(key),
    dismiss: (key: string) => save(new Set([...dismissed, key])),
    dismissAll: (keys: string[]) => save(new Set([...dismissed, ...keys])),
    restoreAll: () => save(new Set()),
  };
}
