// The offline-first read every guest page needs: show the saved copy immediately, then
// replace it from the server when that is reachable.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSync } from '../../context/SyncContext';
import { isNetworkError } from '../../services/api';

type CacheEntry<T> = { value: T; updatedAt: number } | null;

export const useCachedResource = <T>(
  key: string,
  readCached: () => Promise<CacheEntry<T>>,
  fetchFresh: () => Promise<T>,
) => {
  const { isReady } = useSync();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Callers pass inline functions; only `key` decides when to load again.
  const sources = useRef({ readCached, fetchFresh });
  sources.current = { readCached, fetchFresh };

  const reload = useCallback(async () => {
    setRefreshing(true);
    setNotFound(false);
    try {
      const fresh = await sources.current.fetchFresh();
      setData(fresh);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setNotFound(true);
      } else if (!isNetworkError(error)) {
        console.error(`Failed to refresh ${key}:`, error);
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    let cancelled = false;
    sources.current
      .readCached()
      .then((cached) => {
        if (!cancelled && cached) {
          setData(cached.value);
          setLoading(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          reload();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, key, reload]);

  return { data, loading, refreshing, notFound, reload };
};
