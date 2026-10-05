// Local SQLite store backing the offline-first layer.
//
//   cache_entries  key/value JSON snapshots of API responses (home page, clinic
//                  details, a patient's appointments/profile, ...)
//   clinics        the verified-clinic directory, one row per clinic, so search and
//                  filtering run locally and behave the same online or offline
//   sync_queue     writes made while offline (bookings, cancellations, feedback,
//                  profile edits), replayed in order once the server is reachable
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'bukidnon_dental_offline.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const migrate = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS clinics (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        city TEXT,
        address TEXT,
        rating REAL NOT NULL DEFAULT 0,
        specialization_ids TEXT NOT NULL DEFAULT ',',
        search_text TEXT NOT NULL DEFAULT '',
        created_at TEXT,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_clinics_city ON clinics (city);
      CREATE INDEX IF NOT EXISTS idx_clinics_rating ON clinics (rating DESC);

      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        payload TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_owner ON sync_queue (owner_id, status);

      PRAGMA user_version = 1;
    `);
  }
};

export const getDatabase = (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })().catch((error) => {
      // Let the next caller retry instead of caching a rejected promise forever.
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
};

export type CacheEntry<T> = { value: T; updatedAt: number };

export const readCache = async <T>(key: string): Promise<CacheEntry<T> | null> => {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string; updated_at: number }>(
      'SELECT value, updated_at FROM cache_entries WHERE key = ?',
      key,
    );
    if (!row) {
      return null;
    }
    return { value: JSON.parse(row.value) as T, updatedAt: row.updated_at };
  } catch (error) {
    console.warn(`[offline] readCache(${key}) failed`, error);
    return null;
  }
};

export const writeCache = async (key: string, value: unknown): Promise<void> => {
  try {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO cache_entries (key, value, updated_at) VALUES (?, ?, ?)',
      key,
      JSON.stringify(value),
      Date.now(),
    );
  } catch (error) {
    console.warn(`[offline] writeCache(${key}) failed`, error);
  }
};

export const deleteCacheByPrefix = async (prefix: string): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM cache_entries WHERE key LIKE ?', `${prefix}%`);
};
