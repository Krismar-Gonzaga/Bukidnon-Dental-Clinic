import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Set extra.apiUrl in app.json (e.g. your machine's LAN IP) to test on a
// physical device, where neither emulator loopback address is reachable.
export const API_BASE_URL: string =
  Constants.expoConfig?.extra?.apiUrl ||
  Platform.select({
    android: 'http://127.0.0.1:8000/api', // Android emulator
    ios: 'http://127.0.0.1:8000/api', // iOS simulator
    default: 'http://127.0.0.1:8000/api',
  });
