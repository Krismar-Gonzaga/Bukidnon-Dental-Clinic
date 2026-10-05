// Outbox for writes made while offline.
//
// Each row is an HTTP request to replay later. Rows are owned by the user who made
// them so a different account signing in on the same phone never sends them.
// flushQueue() replays rows oldest-first and stops at the first connectivity
// failure so ordering is preserved (e.g. "book" is always sent before "cancel").
import axios from 'axios';
import api, { isNetworkError } from '../http';
import { getDatabase } from './database';

export type MutationKind =
  | 'appointment.create'
  | 'appointment.cancel'
  | 'feedback.create'
  | 'profile.update';

export type QueuedMutation = {
  id: number;
  owner_id: string;
  kind: MutationKind;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  payload: Record<string, unknown> | null;
  status: 'pending' | 'failed';
  attempts: number;
  last_error: string | null;
  created_at: number;
};

type QueueRow = Omit<QueuedMutation, 'payload'> & { payload: string | null };

export type FlushResult = { synced: number; failed: number; remaining: number };

// Server errors are retried this many times before the row is parked as failed.
const MAX_ATTEMPTS = 5;

const queueListeners = new Set<() => void>();

export const subscribeQueue = (listener: () => void) => {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
};

const notify = () => queueListeners.forEach((listener) => listener());

const toMutation = (row: QueueRow): QueuedMutation => ({
  ...row,
  payload: row.payload ? JSON.parse(row.payload) : null,
});

export const enqueue = async (mutation: {
  ownerId: string;
  kind: MutationKind;
  method: QueuedMutation['method'];
  url: string;
  payload?: Record<string, unknown> | null;
}): Promise<number> => {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO sync_queue (owner_id, kind, method, url, payload, status, attempts, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
    mutation.ownerId,
    mutation.kind,
    mutation.method,
    mutation.url,
    mutation.payload ? JSON.stringify(mutation.payload) : null,
    Date.now(),
  );
  notify();
  return result.lastInsertRowId;
};

export const getQueued = async (
  ownerId: string,
  options: { kind?: MutationKind; status?: QueuedMutation['status'] } = {},
): Promise<QueuedMutation[]> => {
  const db = await getDatabase();
  const clauses = ['owner_id = ?'];
  const params: Array<string> = [ownerId];
  if (options.kind) {
    clauses.push('kind = ?');
    params.push(options.kind);
  }
  if (options.status) {
    clauses.push('status = ?');
    params.push(options.status);
  }
  const rows = await db.getAllAsync<QueueRow>(
    `SELECT * FROM sync_queue WHERE ${clauses.join(' AND ')} ORDER BY id ASC`,
    params,
  );
  return rows.map(toMutation);
};

export const countQueued = async (ownerId: string) => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ status: string; total: number }>(
    'SELECT status, COUNT(*) AS total FROM sync_queue WHERE owner_id = ? GROUP BY status',
    ownerId,
  );
  const counts = { pending: 0, failed: 0 };
  rows.forEach((row) => {
    if (row.status === 'pending' || row.status === 'failed') {
      counts[row.status] = row.total;
    }
  });
  return counts;
};

export const removeQueued = async (id: number) => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
  notify();
};

export const retryFailed = async (ownerId: string) => {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE sync_queue SET status = 'pending', attempts = 0, last_error = NULL WHERE owner_id = ? AND status = 'failed'",
    ownerId,
  );
  notify();
};

export const discardFailed = async (ownerId: string) => {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM sync_queue WHERE owner_id = ? AND status = 'failed'", ownerId);
  notify();
};

export const clearQueue = async (ownerId: string) => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE owner_id = ?', ownerId);
  notify();
};

const describeError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : String(error);
};

let activeFlush: Promise<FlushResult> | null = null;

/** Replays pending writes for `ownerId`. Concurrent calls share one run. */
export const flushQueue = (ownerId: string): Promise<FlushResult> => {
  if (!activeFlush) {
    activeFlush = runFlush(ownerId).finally(() => {
      activeFlush = null;
    });
  }
  return activeFlush;
};

const runFlush = async (ownerId: string): Promise<FlushResult> => {
  const db = await getDatabase();
  const pending = await getQueued(ownerId, { status: 'pending' });
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await api.request({
        method: item.method,
        url: item.url,
        data: item.payload ?? undefined,
        timeout: 15000,
      });
      await db.runAsync('DELETE FROM sync_queue WHERE id = ?', item.id);
      synced += 1;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;

      // Lost connection or session expired: keep everything and try again later.
      if (isNetworkError(error) || status === 401) {
        break;
      }

      const attempts = item.attempts + 1;
      const retryable = status === undefined || status >= 500 || status === 429;
      if (retryable && attempts < MAX_ATTEMPTS) {
        await db.runAsync(
          'UPDATE sync_queue SET attempts = ?, last_error = ? WHERE id = ?',
          attempts,
          describeError(error),
          item.id,
        );
        // Stop to keep ordering; the next sync retries from this row.
        break;
      }

      // The server rejected it (validation, not found, slot taken, ...). Park it so
      // it doesn't block later rows; the user can retry or discard it.
      await db.runAsync(
        "UPDATE sync_queue SET status = 'failed', attempts = ?, last_error = ? WHERE id = ?",
        attempts,
        describeError(error),
        item.id,
      );
      failed += 1;
    }
  }

  notify();
  const counts = await countQueued(ownerId);
  return { synced, failed, remaining: counts.pending };
};
