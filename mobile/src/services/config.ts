import Constants from 'expo-constants';

const API_PORT = 8000;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * The computer running Metro, as the phone sees it ("10.59.118.162" from
 * hostUri "10.59.118.162:8081"). In development the phone already reaches
 * this address to load the app, so the Laravel API on the same computer is
 * reachable there too. Null in release builds and for tunnel URLs.
 */
const devServerHost = (): string | null => {
  const hostUri: string | undefined =
    Constants.expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.debuggerHost ?? undefined;
  const host = hostUri?.split(':')[0];
  return host && IPV4.test(host) ? host : null;
};

// Where the Laravel API is, in order:
//  1. extra.apiUrl in app.json, when set (required for release builds, e.g.
//     "https://api.example.ph/api").
//  2. Development: the computer that serves the app (Metro), port 8000.
//     Start the API with `php artisan serve --host=0.0.0.0 --port=8000` so
//     the phone can reach it, and allow port 8000 in the PC firewall.
//  3. 127.0.0.1:8000: emulators/devices using `adb reverse tcp:8000 tcp:8000`.
export const API_BASE_URL: string =
  Constants.expoConfig?.extra?.apiUrl ||
  (__DEV__ && devServerHost() ? `http://${devServerHost()}:${API_PORT}/api` : `http://127.0.0.1:${API_PORT}/api`);
