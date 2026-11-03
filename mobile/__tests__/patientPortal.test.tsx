/**
 * The patient screens that match the website: the data they read and the pages themselves.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('../src/components/common/OfflineBanner', () => () => null);
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 7, name: 'Juan Dela Cruz' }, logout: mockLogout, updateUser: mockUpdateUser }),
}));
jest.mock('../src/context/SyncContext', () => ({
  useSync: () => ({ isReady: true, isOnline: true, isSyncing: false, dataVersion: 0, syncNow: jest.fn(async () => true) }),
}));

const mockLogout = jest.fn();
const mockUpdateUser = jest.fn();
const mockCache: Record<string, unknown> = {};
jest.mock('../src/services/offline/database', () => ({
  getDatabase: jest.fn(async () => ({ getAllAsync: jest.fn(async () => []), getFirstAsync: jest.fn(async () => null) })),
  readCache: jest.fn(async (key: string) => (key in mockCache ? { value: mockCache[key], updatedAt: 1 } : null)),
  writeCache: jest.fn(async (key: string, value: unknown) => {
    mockCache[key] = value;
  }),
  deleteCacheByPrefix: jest.fn(),
}));
jest.mock('../src/services/offline/syncQueue', () => ({
  splitLocalFields: (payload: Record<string, unknown>) => ({ body: payload }),
  enqueue: jest.fn(async () => 42),
  getQueued: jest.fn(async () => []),
  removeQueued: jest.fn(),
  clearQueue: jest.fn(),
}));
jest.mock('../src/services/session', () => ({
  readUser: jest.fn(async () => ({ id: 7 })),
  readToken: jest.fn(async () => 'token-value'),
  clearSession: jest.fn(),
}));
jest.mock('../src/services/offline/network', () => ({ isOnline: () => mockOnline.value, setOnline: jest.fn() }));

const mockOnline = { value: true };
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
const mockRequest = jest.fn();
jest.mock('../src/services/http', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    request: (...args: unknown[]) => mockRequest(...args),
  },
  isNetworkError: (error: any) => Boolean(error?.isAxiosError && !error.response),
}));

const { toProfile, medicalAlerts, profileChips, splitName, joinName, ageFrom, appointmentGroup, canReschedule, passwordStrength } = require('../src/services/patientPortal');
const { calendarMonths } = require('../src/components/patient/PatientUi');
const { notificationStyle } = require('../src/screens/patient/NotificationsScreen');
const { cleanHealth } = require('../src/screens/patient/EditProfileScreen');
const { offlinePatientService } = require('../src/services/offline/patientRepository');
const PatientHomeScreen = require('../src/screens/patient/PatientHomeScreen').default;
const AppointmentsScreen = require('../src/screens/patient/AppointmentsScreen').default;
const AppointmentDetailsScreen = require('../src/screens/patient/AppointmentDetailsScreen').default;
const FeedbackScreen = require('../src/screens/patient/FeedbackScreen').default;
const ProfileScreen = require('../src/screens/patient/ProfileScreen').default;
const ChangePasswordScreen = require('../src/screens/patient/ChangePasswordScreen').default;

const HEALTH = {
  conditions: ['Hypertension'],
  procedures: [{ name: 'Tooth Extraction', date: 'March 2024' }],
  vitals: { blood_pressure: { value: '130/85 mmHg', note: 'Elevated' } },
  allergies: [{ name: 'Penicillin', type: 'drug', severity: 'severe', reaction: 'Hives' }],
  medications: [{ name: 'Amlodipine', dosage: '5mg', purpose: 'Hypertension' }],
  anxiety: { level: 3, sedation: 'Local only' },
};

const API_PROFILE = {
  name: 'Juan Dela Cruz',
  email: 'juan@example.com',
  phone: '0917',
  address: 'Sayre Highway',
  birth_date: '1995-03-15',
  gender: 'male',
  civil_status: 'single',
  blood_type: 'O+',
  city: 'Valencia City',
  province: 'Bukidnon',
  zip_code: '8709',
  emergency_contact_name: 'Maria',
  emergency_contact_phone: '0918',
  emergency_contact_relationship: 'Mother',
  photo_version: null,
  health: HEALTH,
  consents: { share_medical_history: true, promotions: false },
  notification_preferences: { email: true },
};

const appointment = (overrides = {}) => ({
  id: 6,
  status: 'pending',
  starts_at: '2026-11-08T10:00:00+08:00',
  appointment_date: '2026-11-08',
  appointment_time: '10:00',
  clinic: { id: 7, name: 'Valencia Smiles' },
  dentist: { id: 1, name: 'Dr. Reyes' },
  service: { id: 3, name: 'Root Canal' },
  ...overrides,
});

const DASHBOARD = {
  name: 'Juan Dela Cruz',
  upcoming: [appointment(), appointment({ id: 9, status: 'confirmed', service: { id: 4, name: 'Braces' } })],
  counts: { total: 6, upcoming: 2, pending: 1, completed: 3, saved_clinics: 2, reviews_given: 1 },
  unread_notifications: 1,
};

const navigation = { navigate: jest.fn(), goBack: jest.fn(), popTo: jest.fn(), popToTop: jest.fn(), addListener: jest.fn(() => jest.fn()) };

const allText = (root: ReactTestRenderer.ReactTestInstance) =>
  root
    .findAll((node) => (node.type as unknown) === 'Text')
    .map((node) => node.children.filter((child) => typeof child === 'string').join(''))
    .join(' | ');

const render = async (element: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
};

const pressLabel = async (tree: ReactTestRenderer.ReactTestRenderer, label: string) => {
  const target = tree.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0];
  await ReactTestRenderer.act(async () => {
    await target.props.onPress();
  });
};

const respond = (routes: Record<string, unknown>) =>
  mockGet.mockImplementation(async (url: string) => {
    if (url in routes) {
      return { data: routes[url] };
    }
    throw Object.assign(new Error(`Unexpected GET ${url}`), { response: { status: 404 } });
  });

const COMMON = {
  '/notifications': { data: [], meta: { unread_count: 1 } },
};

beforeEach(() => {
  Object.keys(mockCache).forEach((key) => delete mockCache[key]);
  [mockGet, mockPost, mockPut, mockDelete, mockRequest, mockLogout, mockUpdateUser].forEach((mock) => mock.mockReset());
  mockOnline.value = true;
  jest.clearAllMocks();
});

describe('helpers', () => {
  test('the profile keeps the website’s labels and knows when health is unavailable', () => {
    const profile = toProfile(API_PROFILE);
    expect(profile).toMatchObject({ gender: 'Male', civilStatus: 'Single', bloodType: 'O+', healthAvailable: true });

    const offline = toProfile({ ...API_PROFILE, health: undefined });
    expect(offline.healthAvailable).toBe(false);
    expect(offline.health.allergies).toEqual([]);
  });

  test('alerts and chips say what a dentist must know, or nothing', () => {
    expect(medicalAlerts({ health: HEALTH })).toBe('Allergic to Penicillin · Taking Amlodipine (5mg) for hypertension · Hypertension — inform your dentist before any procedure.');
    expect(profileChips({ bloodType: 'O+', health: HEALTH }).map(({ label }: any) => label)).toEqual(['O+', 'Hypertension', 'Penicillin Allergy']);
    const none = toProfile({}).health;
    expect(medicalAlerts({ health: none })).toBe('');
    expect(profileChips({ bloodType: '', health: none })).toEqual([]);
  });

  test('a name splits into two fields and joins back unchanged', () => {
    expect(splitName('Maria Clara Santos')).toEqual({ firstName: 'Maria', lastName: 'Clara Santos' });
    expect(joinName('Maria', 'Clara Santos')).toBe('Maria Clara Santos');
    expect(joinName('Cher', '')).toBe('Cher');
  });

  test('age counts birthdays', () => {
    expect(ageFrom('1995-03-15', new Date(2026, 2, 14))).toBe(30);
    expect(ageFrom('1995-03-15', new Date(2026, 2, 15))).toBe(31);
  });

  test('statuses group like the website; only real appointments can be rescheduled', () => {
    expect(appointmentGroup('reschedule_requested')).toBe('upcoming');
    expect(appointmentGroup('no_show')).toBe('cancelled');
    expect(canReschedule(appointment({ status: 'confirmed' }))).toBe(true);
    expect(canReschedule(appointment({ status: 'completed' }))).toBe(false);
    expect(canReschedule(appointment({ id: 'local-3' }))).toBe(false);
  });

  test('the calendar lines weekdays up with Monday first and splits months', () => {
    // 2026-11-30 is a Monday, 2026-12-01 a Tuesday.
    const months = calendarMonths(['2026-11-30', '2026-12-01']);
    expect(months.map(({ title }: any) => title)).toEqual(['NOVEMBER 2026', 'DECEMBER 2026']);
    expect(months[0].cells).toEqual(['2026-11-30']);
    expect(months[1].cells).toEqual([null, '2026-12-01']);
  });

  test('password strength names the next thing to add', () => {
    expect(passwordStrength('abcdefgh')).toMatchObject({ label: 'Weak', hint: 'add a symbol' });
    expect(passwordStrength('abcdefg!')).toMatchObject({ label: 'Medium', hint: 'add a number' });
    expect(passwordStrength('Abcdef1!')).toMatchObject({ label: 'Strong', hint: '' });
  });

  test('notifications get the website’s icons', () => {
    expect(notificationStyle('reminder').icon).toBe('notifications-outline');
    expect(notificationStyle('appointment').icon).toBe('checkmark-circle-outline');
    expect(notificationStyle('review').icon).toBe('chatbox-outline');
  });

  test('blank rows are not saved', () => {
    const cleaned = cleanHealth({ ...toProfile({}).health, allergies: [{ name: ' ', type: 'drug', severity: 'mild' }, { name: 'Latex', type: 'material', severity: 'mild' }] }, [{ name: ' Asthma ' }, { name: '' }]);
    expect(cleaned.conditions).toEqual(['Asthma']);
    expect(cleaned.allergies.map(({ name }: any) => name)).toEqual(['Latex']);
  });
});

describe('health details stay off the device', () => {
  test('the saved copy of the profile has no health details, and the screen says why offline', async () => {
    respond({ '/patient/profile': { data: API_PROFILE } });
    const online = await offlinePatientService.getProfile();
    expect(online.data.data.health.allergies[0].name).toBe('Penicillin');

    const saved = mockCache['patient:7:profile'] as Record<string, unknown>;
    expect(saved.blood_type).toBe('O+');
    expect(saved.health).toBeUndefined();
    expect(JSON.stringify(saved)).not.toContain('Penicillin');

    mockOnline.value = false;
    const offline = await offlinePatientService.getProfile();
    expect(toProfile(offline.data.data).healthAvailable).toBe(false);
  });
});

describe('pages', () => {
  test('the dashboard shows the greeting, counts and both kinds of appointment', async () => {
    respond({ '/patient/dashboard': { data: DASHBOARD }, ...COMMON });
    const tree = await render(<PatientHomeScreen navigation={navigation} />);
    const text = allText(tree.root);

    expect(text).toContain('Juan Dela Cruz');
    expect(text).toContain('Saved Clinics');
    expect(text).toContain('Quick Actions');
    expect(text).toContain('Awaiting clinic approval · Requested November 8, 2026 at 10:00 AM');

    await pressLabel(tree, 'Reschedule Braces');
    expect(navigation.navigate).toHaveBeenCalledWith('Reschedule', { appointment: DASHBOARD.upcoming[1] });
  });

  test('the sidebar has every page and logs out', async () => {
    respond({ '/patient/dashboard': { data: DASHBOARD }, ...COMMON });
    const tree = await render(<PatientHomeScreen navigation={navigation} />);
    await pressLabel(tree, 'Open menu');
    const text = allText(tree.root);
    ['Dashboard', 'Book Appointment', 'Appointment History', 'Notifications', 'Find Clinics', 'Saved Clinics', 'Clinic Locator', 'My Profile', 'Log Out'].forEach((label) =>
      expect(text).toContain(label),
    );
  });

  test('history filters by the website’s groups and offers the right actions', async () => {
    respond({
      '/patient/appointments': {
        data: [
          appointment(),
          appointment({ id: 2, status: 'confirmed', service: { id: 4, name: 'Braces' } }),
          appointment({ id: 3, status: 'completed', service: { id: 5, name: 'Cleaning' } }),
          appointment({ id: 4, status: 'completed', has_review: true, service: { id: 6, name: 'Whitening' } }),
        ],
      },
      ...COMMON,
    });
    const tree = await render(<AppointmentsScreen navigation={navigation} />);
    const labels = () => tree.root.findAll((node) => Boolean(node.props.accessibilityLabel) && Boolean(node.props.onPress)).map((node) => node.props.accessibilityLabel);

    expect(allText(tree.root)).toContain('Awaiting Approval');
    expect(labels()).toContain('Reschedule Braces');
    expect(labels()).toContain('Review Cleaning');
    expect(labels()).not.toContain('Review Whitening');
    expect(labels()).not.toContain('Reschedule Root Canal');

    const completed = tree.root.findAll((node) => (node.type as unknown) === 'Text' && node.children.join('') === 'Completed')[0];
    let chip: ReactTestRenderer.ReactTestInstance | null = completed;
    while (chip && !chip.props.onPress) {
      chip = chip.parent;
    }
    await ReactTestRenderer.act(async () => {
      chip!.props.onPress();
    });
    expect(allText(tree.root)).toContain('Cleaning');
    expect(allText(tree.root)).not.toContain('Braces');
  });

  test('cancelling asks first, names the dentist, and only then calls the server', async () => {
    mockRequest.mockResolvedValue({ data: { data: null } });
    respond({ '/patient/appointments': { data: [appointment()] }, ...COMMON });
    const tree = await render(<AppointmentDetailsScreen navigation={navigation} route={{ params: { appointment: appointment() } }} />);
    const text = allText(tree.root);

    expect(text).toContain('Appointment #000006');
    expect(text).toContain('Awaiting Clinic Approval');

    const press = async (label: string) => {
      const node = tree.root.findAll((item) => (item.type as unknown) === 'Text' && item.children.join('') === label)[0];
      let target: ReactTestRenderer.ReactTestInstance | null = node;
      while (target && !target.props.onPress) {
        target = target.parent;
      }
      await ReactTestRenderer.act(async () => {
        await target!.props.onPress();
      });
    };

    await press('Cancel Request');
    expect(allText(tree.root)).toContain('Are you sure you want to cancel your appointment with Dr. Reyes?');
    expect(mockRequest).not.toHaveBeenCalled();

    await press('Keep Appointment');
    expect(mockRequest).not.toHaveBeenCalled();

    await press('Cancel Request');
    await press('Yes, Cancel');
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'DELETE', url: '/patient/appointments/6' }));
    expect(allText(tree.root)).toContain('Appointment cancelled');
  });

  test('a review needs a visit and a rating, then says thank you', async () => {
    mockRequest.mockResolvedValue({ data: { data: {} } });
    respond({ '/patient/reviews/eligible': { data: [appointment({ id: 3, status: 'completed', service: { id: 5, name: 'Cleaning' } })] }, ...COMMON });
    const tree = await render(<FeedbackScreen navigation={navigation} route={{ params: { appointmentId: 3 } }} />);

    await pressLabel(tree, 'Submit Review');
    expect(mockRequest).not.toHaveBeenCalled();

    await pressLabel(tree, '4 of 5 stars');
    expect(allText(tree.root)).toContain('Very Good');

    await pressLabel(tree, 'Submit Review');
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', url: '/patient/appointments/3/review' }));
    expect(allText(tree.root)).toContain('Review Submitted!');
  });

  test('the profile shows alerts and tabs; consent switches save at once', async () => {
    mockPut.mockResolvedValue({ data: {} });
    respond({
      '/patient/profile': { data: API_PROFILE },
      '/patient/dashboard': { data: DASHBOARD },
      '/patient/medical-history': { data: [] },
      '/patient/records': { data: [] },
      ...COMMON,
    });
    const tree = await render(<ProfileScreen navigation={navigation} />);
    let text = allText(tree.root);
    expect(text).toContain('Important Medical Alerts');
    expect(text).toContain('Penicillin Allergy');
    expect(text).toContain('Total Appointments');
    expect(text).toContain('31 years old');

    const tab = async (label: string) => {
      const node = tree.root.findAll((item) => (item.type as unknown) === 'Text' && item.children.join('') === label)[0];
      let target: ReactTestRenderer.ReactTestInstance | null = node;
      while (target && !target.props.onPress) {
        target = target.parent;
      }
      await ReactTestRenderer.act(async () => {
        target!.props.onPress();
      });
    };

    await tab('Allergies & Medications');
    text = allText(tree.root);
    expect(text).toContain('Severe');
    expect(text).toContain('Reaction: Hives');

    await tab('Emergency Contact');
    text = allText(tree.root);
    expect(text).toContain('Maria');
    expect(text).not.toContain('SMS');

    const toggle = tree.root.findAll((node) => node.props.accessibilityLabel === 'Promotional offers and dental health tips' && node.props.onValueChange)[0];
    await ReactTestRenderer.act(async () => {
      await toggle.props.onValueChange(true);
    });
    expect(mockPut).toHaveBeenCalledWith('/patient/profile', { consents: { promotions: true } });

    const email = tree.root.findAll((node) => node.props.accessibilityLabel === 'Email appointment reminders' && node.props.onValueChange)[0];
    await ReactTestRenderer.act(async () => {
      await email.props.onValueChange(false);
    });
    expect(mockPut).toHaveBeenCalledWith('/notification-preferences', { email: false });
  });

  test('change password checks the confirmation, then shows success', async () => {
    mockPost.mockResolvedValue({ data: {} });
    respond(COMMON);
    const tree = await render(<ChangePasswordScreen navigation={navigation} />);
    const type = (label: string, value: string) =>
      ReactTestRenderer.act(() => {
        tree.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onChangeText)[0].props.onChangeText(value);
      });

    type('Current Password', 'old-pass');
    type('New Password', 'Abcdef1!');
    type('Confirm New Password', 'different');
    await pressLabel(tree, 'Update Password');
    expect(mockPost).not.toHaveBeenCalled();
    expect(allText(tree.root)).toContain('The new passwords do not match.');

    type('Confirm New Password', 'Abcdef1!');
    await pressLabel(tree, 'Update Password');
    expect(mockPost).toHaveBeenCalledWith('/change-password', {
      current_password: 'old-pass',
      new_password: 'Abcdef1!',
      new_password_confirmation: 'Abcdef1!',
    });
    expect(allText(tree.root)).toContain('Password Changed!');
  });
});
