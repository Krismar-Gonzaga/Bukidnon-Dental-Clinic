// Where the signed-in session lives on the device.
//
// - The API token is a credential: it is kept in the platform keystore
//   (Android Keystore / iOS Keychain) via expo-secure-store, never in plain
//   AsyncStorage.
// - The cached user profile (name, email, role) is not a secret and stays in
//   AsyncStorage so screens can render it before the network answers.
//
// Older builds stored the token in AsyncStorage; readToken() moves it into the
// keystore the first time it runs and deletes the plain copy.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const LEGACY_TOKEN_KEY = 'token';
const USER_KEY = 'user';

const secureAvailable = async () => {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

export const saveToken = async (token: string) => {
  if (!(await secureAvailable())) {
    // e.g. Expo web preview: there is no keystore, so the session is not kept.
    memoryToken = token;
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

// Fallback for platforms without a keystore (lives only until the app closes).
let memoryToken: string | null = null;

export const readToken = async (): Promise<string | null> => {
  if (!(await secureAvailable())) {
    return memoryToken;
  }
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    return token;
  }
  const legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacy) {
    await SecureStore.setItemAsync(TOKEN_KEY, legacy);
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
  }
  return legacy;
};

export const saveUser = (user: unknown) => AsyncStorage.setItem(USER_KEY, JSON.stringify(user));

export const readUser = async <T>(): Promise<T | null> => {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
};

/** Forgets the session on this device (logout, expired or revoked token). */
export const clearSession = async () => {
  memoryToken = null;
  await Promise.all([
    AsyncStorage.removeItem(USER_KEY),
    AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
    (async () => {
      if (await secureAvailable()) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    })(),
  ]);
};
