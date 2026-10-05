// Drives the offline-first layer: tracks connectivity and, whenever the server is
// reachable again (reconnect, app resume, login, pull-to-refresh), pushes queued
// writes first and then refreshes the local copy of public data.
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { getDatabase } from '../services/offline/database';
import { isOnline as currentlyOnline, probe, subscribeNetwork } from '../services/offline/network';
import { getLastPublicSync, syncPublicData } from '../services/offline/publicRepository';
import {
  countQueued,
  discardFailed,
  flushQueue,
  retryFailed,
  subscribeQueue,
} from '../services/offline/syncQueue';

type SyncContextType = {
  /** The API server is reachable. */
  isOnline: boolean;
  isSyncing: boolean;
  /** Local database opened; screens can read from it. */
  isReady: boolean;
  lastSyncedAt: number | null;
  /** Writes saved on the device and not yet sent. */
  pendingCount: number;
  /** Writes the server rejected; they need the user's attention. */
  failedCount: number;
  /** Bumped after every successful sync so screens know to re-read local data. */
  dataVersion: number;
  syncNow: () => Promise<boolean>;
  retryFailedChanges: () => Promise<void>;
  discardFailedChanges: () => Promise<void>;
};

const SyncContext = createContext<SyncContextType | undefined>(undefined);

// How often to re-check reachability. Faster while offline so reconnects are noticed
// quickly; slower while online since every API call already reports failures.
const OFFLINE_PROBE_MS = 15000;
const ONLINE_PROBE_MS = 60000;
// Automatic syncs (resume, reconnect) are skipped if one ran this recently.
const AUTO_SYNC_COOLDOWN_MS = 30000;

export const SyncProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const ownerId = user?.id != null ? String(user.id) : null;

  const [isOnline, setIsOnline] = useState(currentlyOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  const syncingRef = useRef<Promise<boolean> | null>(null);
  const lastAttemptRef = useRef(0);
  const ownerRef = useRef(ownerId);
  ownerRef.current = ownerId;

  const refreshCounts = useCallback(async () => {
    const owner = ownerRef.current;
    if (!owner) {
      setPendingCount(0);
      setFailedCount(0);
      return;
    }
    try {
      const counts = await countQueued(owner);
      setPendingCount(counts.pending);
      setFailedCount(counts.failed);
    } catch (error) {
      console.warn('[sync] could not count queued changes', error);
    }
  }, []);

  const runSync = useCallback((): Promise<boolean> => {
    if (syncingRef.current) {
      return syncingRef.current;
    }
    const task = (async () => {
      setIsSyncing(true);
      lastAttemptRef.current = Date.now();
      try {
        if (!(await probe())) {
          return false;
        }
        // Push local changes before pulling, so refreshed data already includes them.
        const owner = ownerRef.current;
        if (owner) {
          await flushQueue(owner);
        }
        await syncPublicData();
        setLastSyncedAt(Date.now());
        return true;
      } catch (error) {
        console.warn('[sync] sync failed', error);
        return false;
      } finally {
        // Screens re-read local data even after a partial sync (e.g. queue flushed).
        setDataVersion((version) => version + 1);
        await refreshCounts();
        setIsSyncing(false);
        syncingRef.current = null;
      }
    })();
    syncingRef.current = task;
    return task;
  }, [refreshCounts]);

  const autoSync = useCallback(() => {
    if (Date.now() - lastAttemptRef.current < AUTO_SYNC_COOLDOWN_MS) {
      return;
    }
    runSync();
  }, [runSync]);

  // Open the database, show whatever is saved, then try to sync.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getDatabase();
        const last = await getLastPublicSync();
        if (!cancelled) {
          setLastSyncedAt(last);
        }
      } catch (error) {
        console.error('[sync] could not open offline database', error);
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
      if (!cancelled) {
        runSync();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runSync]);

  // React to connectivity changes reported by probes or API calls.
  useEffect(
    () =>
      subscribeNetwork((online) => {
        setIsOnline(online);
        if (online) {
          // Just came back: send queued changes and refresh right away.
          lastAttemptRef.current = 0;
          autoSync();
        }
      }),
    [autoSync],
  );

  // Periodic reachability checks.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!syncingRef.current) {
        probe();
      }
    }, isOnline ? ONLINE_PROBE_MS : OFFLINE_PROBE_MS);
    return () => clearInterval(timer);
  }, [isOnline]);

  // Sync when the app returns to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        autoSync();
      }
    });
    return () => subscription.remove();
  }, [autoSync]);

  // Keep queue counters current, and sync right after a user signs in.
  useEffect(() => subscribeQueue(() => { refreshCounts(); }), [refreshCounts]);
  useEffect(() => {
    refreshCounts();
    if (ownerId) {
      lastAttemptRef.current = 0;
      autoSync();
    }
  }, [ownerId, refreshCounts, autoSync]);

  const retryFailedChanges = useCallback(async () => {
    if (ownerRef.current) {
      await retryFailed(ownerRef.current);
      await runSync();
    }
  }, [runSync]);

  const discardFailedChanges = useCallback(async () => {
    if (ownerRef.current) {
      await discardFailed(ownerRef.current);
      setDataVersion((version) => version + 1);
    }
  }, []);

  const value = useMemo(
    () => ({
      isOnline,
      isSyncing,
      isReady,
      lastSyncedAt,
      pendingCount,
      failedCount,
      dataVersion,
      syncNow: runSync,
      retryFailedChanges,
      discardFailedChanges,
    }),
    [
      isOnline,
      isSyncing,
      isReady,
      lastSyncedAt,
      pendingCount,
      failedCount,
      dataVersion,
      runSync,
      retryFailedChanges,
      discardFailedChanges,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
};
