import { getData } from './apiClient';
import { setPlatform } from './platformStore';

/** Reads the public platform settings. If it fails, the app runs on the defaults. */
export async function loadPlatform() {
  try {
    const values = await getData('/platform');
    if (values) setPlatform(values);
  } catch {
    // The pages report their own connection problems.
  }
}
