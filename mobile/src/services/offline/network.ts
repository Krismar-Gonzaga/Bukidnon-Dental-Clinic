// Connectivity tracking for the offline-first layer.
//
// "Online" here means "the API server is reachable", not "the phone has a radio
// connection" — being on Wi-Fi with the backend down is still offline as far as the
// app is concerned. State is fed passively by every API response (see http.ts) and
// actively by probe(), which SyncContext calls on an interval and on app resume.
// This needs no native module, so it works in the existing dev build.
import { API_BASE_URL } from '../config';

type Listener = (online: boolean) => void;

const PROBE_TIMEOUT_MS = 6000;

// Optimistic until the first probe or request says otherwise, so the very first
// launch tries the network instead of assuming there is none.
let online = true;
const listeners = new Set<Listener>();

export const isOnline = () => online;

export const setOnline = (value: boolean) => {
  if (value === online) {
    return;
  }
  online = value;
  listeners.forEach((listener) => listener(value));
};

export const subscribeNetwork = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Pings a small public endpoint and updates the online flag. */
export const probe = async (): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // Any HTTP response proves reachability, whatever its status.
    await fetch(`${API_BASE_URL}/cities`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    setOnline(true);
    return true;
  } catch {
    setOnline(false);
    return false;
  } finally {
    clearTimeout(timer);
  }
};
