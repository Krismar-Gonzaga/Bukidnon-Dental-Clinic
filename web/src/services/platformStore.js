import { useSyncExternalStore } from 'react';
import { BRAND_NAME } from '../config/app';

// What the System Settings page decides for everyone: the platform's name, and whether it is
// open. Loaded once when the app starts (loadPlatform in platformApi.js), so pages read it
// without a request of their own. Until then the defaults stand.

let platform = {
  platform_name: BRAND_NAME,
  support_email: null,
  maintenance_mode: false,
  allow_self_registration: true,
};
const listeners = new Set();

export function setPlatform(values) {
  platform = { ...platform, ...values };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const usePlatform = () => useSyncExternalStore(subscribe, () => platform);

/** The platform name, wherever the brand is shown. */
export const useBrandName = () => usePlatform().platform_name;
