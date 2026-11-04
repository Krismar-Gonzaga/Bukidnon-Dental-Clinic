/**
 * Which API address the app uses (src/services/config.ts).
 */
const loadWith = (expoConfig: Record<string, unknown>) => {
  let url = '';
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig } }));
    url = require('../src/services/config').API_BASE_URL;
  });
  return url;
};

afterEach(() => jest.dontMock('expo-constants'));

test('development: uses the computer serving the app (Metro host), port 8000', () => {
  expect(loadWith({ hostUri: '10.59.118.162:8081', extra: {} })).toBe('http://10.59.118.162:8000/api');
});

test('extra.apiUrl overrides the detected address', () => {
  expect(loadWith({ hostUri: '10.59.118.162:8081', extra: { apiUrl: 'https://api.example.ph/api' } })).toBe(
    'https://api.example.ph/api'
  );
});

test('falls back to 127.0.0.1 (adb reverse) for tunnel hosts or no host', () => {
  expect(loadWith({ hostUri: 'abc-anonymous-8081.exp.direct', extra: {} })).toBe('http://127.0.0.1:8000/api');
  expect(loadWith({ extra: {} })).toBe('http://127.0.0.1:8000/api');
});
