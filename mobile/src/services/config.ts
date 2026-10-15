import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Which address reaches the Laravel API depends on where the app runs:
//  - Android emulator: 10.0.2.2 is the host computer (127.0.0.1 is the emulator itself).
//  - iOS simulator: 127.0.0.1 is the host computer.
//  - Physical phone: neither works. Set extra.apiUrl in app.json to the computer's
//    LAN address, e.g. "http://192.168.1.20:8000/api", and start the API with
//    `php artisan serve --host=0.0.0.0 --port=8000`.
export const API_BASE_URL: string =
  Constants.expoConfig?.extra?.apiUrl ||
  Platform.select({
    android: 'http://10.0.2.2:8000/api',
    ios: 'http://127.0.0.1:8000/api',
    default: 'http://127.0.0.1:8000/api',
  });
