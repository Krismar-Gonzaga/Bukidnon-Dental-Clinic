import { useCallback, useEffect, useState } from 'react';

const MAX_KEYS = 200;

const read = (storageKey) => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
};

/**
 * Dashboard alerts this viewer chose to hide ("Ignore", "Mark All as Read").
 * Alerts are worked out live from clinic data, so hiding one is a per-viewer
 * preference kept in this browser only; it never changes clinic data. A key
 * includes the alert's message, so an alert whose details change (e.g. stock
 * drops further) shows again.
 */
export function useDismissedAlerts(storageKey) {
  const [dismissed, setDismissed] = useState(() => read(storageKey));

  useEffect(() => setDismissed(read(storageKey)), [storageKey]);

  const save = useCallback(
    (next) => {
      setDismissed(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next].slice(-MAX_KEYS)));
      } catch {
        // Storage unavailable (private mode, blocked): the choice lasts for this visit only.
      }
    },
    [storageKey]
  );

  return {
    isDismissed: (key) => dismissed.has(key),
    dismiss: (key) => save(new Set([...dismissed, key])),
    dismissAll: (keys) => save(new Set([...dismissed, ...keys])),
    restoreAll: () => save(new Set()),
  };
}

export const alertKey = (alert) => `${alert.type}|${alert.title}|${alert.message}`;
