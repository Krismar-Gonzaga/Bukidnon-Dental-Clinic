/**
 * Guest screens that match the website: the data they read and the pages themselves.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('../src/components/common/OfflineBanner', () => () => null);
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false, user: null, logout: jest.fn() }) }));

const mockCache: Record<string, unknown> = {};
jest.mock('../src/services/offline/database', () => ({
  getDatabase: jest.fn(),
  readCache: jest.fn(async (key: string) => (key in mockCache ? { value: mockCache[key], updatedAt: 1 } : null)),
  writeCache: jest.fn(async (key: string, value: unknown) => {
    mockCache[key] = value;
  }),
  deleteCacheByPrefix: jest.fn(),
}));

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../src/services/http', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockGet(...args), post: (...args: unknown[]) => mockPost(...args) },
  isNetworkError: (error: any) => Boolean(error?.isAxiosError && !error.response),
}));
jest.mock('../src/context/SyncContext', () => ({
  useSync: () => ({ isReady: true, isOnline: true, isSyncing: false, dataVersion: 0, syncNow: jest.fn(async () => true) }),
}));

const repository = require('../src/services/offline/publicRepository');
const { normalizeClinicDetails, fetchDentists, getCachedDentist, fetchServiceCatalog } = repository;
const { workingHours, openDaysSummary } = require('../src/components/guest/workingHours');
const { formatPriceRange, formatDurationRange } = require('../src/utils/format');
const GuestContactScreen = require('../src/screens/guest/GuestContactScreen').default;
const { validateContact } = require('../src/screens/guest/GuestContactScreen');
const GuestDentistsScreen = require('../src/screens/guest/GuestDentistsScreen').default;
const GuestDentistProfileScreen = require('../src/screens/guest/GuestDentistProfileScreen').default;
const GuestServicesScreen = require('../src/screens/guest/GuestServicesScreen').default;
const GuestAboutScreen = require('../src/screens/guest/GuestAboutScreen').default;
const { aboutStats } = require('../src/screens/guest/GuestAboutScreen');
const GuestLegalScreen = require('../src/screens/guest/GuestLegalScreen').default;
const { projectToMap } = require('../src/screens/guest/GuestHomeScreen');

const API_DENTIST = {
  id: 4,
  name: 'Dr. Ana Reyes',
  specialization: 'Orthodontics',
  specialization_id: 2,
  years_experience: 8,
  rating: 4.5,
  review_count: 2,
  is_available: true,
  qualifications: 'DMD, Bukidnon State',
  bio: 'Gentle with kids.',
  clinics: [{ id: 7, name: 'Valencia Smiles', city: 'Valencia', address: 'Sayre Highway, Valencia' }],
  schedules: [
    { day_of_week: 1, starts_at: '08:00:00', ends_at: '17:00:00' },
    { day_of_week: 2, starts_at: '08:00:00', ends_at: '17:00:00' },
  ],
};

const API_SERVICE = {
  id: 1,
  name: 'Dental Cleaning',
  category: 'Preventive',
  description: 'Removes plaque.',
  price_min: 800,
  price_max: 1500,
  duration_min: 30,
  duration_max: 60,
  clinic_count: 3,
};

const navigation = { navigate: jest.fn(), goBack: jest.fn(), popTo: jest.fn(), popToTop: jest.fn() };

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

const respond = (routes: Record<string, unknown>) =>
  mockGet.mockImplementation(async (url: string) => {
    if (url in routes) {
      return { data: routes[url] };
    }
    throw Object.assign(new Error(`Unexpected GET ${url}`), { response: { status: 404 } });
  });

beforeEach(() => {
  Object.keys(mockCache).forEach((key) => delete mockCache[key]);
  mockGet.mockReset();
  mockPost.mockReset();
  jest.clearAllMocks();
});

describe('data', () => {
  test('clinic details carry the review count and each dentist’s rating and availability', () => {
    const clinic = normalizeClinicDetails({
      id: 7,
      name: 'Valencia Smiles',
      province: 'Bukidnon',
      review_count: 12,
      dentists: [
        { id: 1, name: 'Dr. A', rating: 4.5, review_count: 2, is_available: true },
        { id: 2, name: 'Dr. B', rating: null, review_count: 0, is_available: false },
      ],
    });
    expect(clinic.reviewCount).toBe(12);
    expect(clinic.dentists[0]).toMatchObject({ rating: 4.5, reviewCount: 2, isAvailable: true });
    expect(clinic.dentists[1]).toMatchObject({ rating: null, reviewCount: 0, isAvailable: false });
  });

  test('the dentist directory downloads every page and is saved for offline use', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { data: [API_DENTIST], meta: { last_page: 2 } } })
      .mockResolvedValueOnce({ data: { data: [{ ...API_DENTIST, id: 5, rating: null }], meta: { last_page: 2 } } });

    const dentists = await fetchDentists();

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(dentists.map((dentist: any) => dentist.id)).toEqual([4, 5]);
    expect(dentists[0].schedules[0]).toEqual({ day: 1, startsAt: '08:00:00', endsAt: '17:00:00' });
    expect((await getCachedDentist(5)).value.rating).toBeNull();
  });

  test('the service catalog keeps a missing price as unknown, not zero', async () => {
    respond({ '/services': { data: [API_SERVICE, { ...API_SERVICE, id: 2, price_min: null, price_max: null }] } });
    const services = await fetchServiceCatalog();
    expect(services[0]).toMatchObject({ priceMin: 800, priceMax: 1500, clinicCount: 3 });
    expect(formatPriceRange(services[0].priceMin, services[0].priceMax)).toBe('₱800 – ₱1,500');
    expect(formatPriceRange(services[1].priceMin, services[1].priceMax)).toBe('Price on request');
    expect(formatDurationRange(30, 60)).toBe('30–60 min');
    expect(formatDurationRange(30, 30)).toBe('30 min');
  });

  test('working hours group equal days and show closed ones', () => {
    const rows = workingHours([
      { day: 1, start: '08:00:00', end: '17:00:00' },
      { day: 2, start: '08:00:00', end: '17:00:00' },
      { day: 3, start: '09:00:00', end: '12:00:00' },
      { day: 3, start: '13:00:00', end: '16:00:00' },
    ]);
    expect(rows).toEqual([
      { days: 'Mon–Tue', text: '8:00 AM – 5:00 PM' },
      { days: 'Wed', text: '9:00 AM – 4:00 PM' },
      { days: 'Thu–Sun', text: 'Closed' },
    ]);
    expect(openDaysSummary([{ day: 1, start: '08:00:00', end: '17:00:00' }])).toBe('Mon 8:00 AM – 5:00 PM');
  });

  test('map pins stay inside Bukidnon and clinics without coordinates are not pinned', () => {
    const pin = projectToMap({ latitude: 8.05, longitude: 124.95 });
    expect(pin.x).toBeCloseTo(50);
    expect(pin.y).toBeCloseTo(50);
    expect(projectToMap({ latitude: 14.6, longitude: 121 })).toBeNull();
    expect(projectToMap({ latitude: null, longitude: null })).toBeNull();
  });

  test('about figures that are not known show a dash, never a sample number', () => {
    expect(aboutStats(undefined).map((stat: any) => stat.value)).toEqual(['—', '—', '—', '—']);
    const stats = aboutStats({ verifiedClinics: 4, totalReviews: 2, totalSpecializations: 1, patients: 1250, municipalities: 3, satisfactionRate: null });
    expect(stats.map((stat: any) => stat.value)).toEqual(['4', '1,250', '—', '3']);
  });
});

describe('contact form', () => {
  const fill = (tree: ReactTestRenderer.ReactTestRenderer) => {
    const input = (label: string) => tree.root.find((node) => node.props.accessibilityLabel === label && node.props.onChangeText);
    ReactTestRenderer.act(() => {
      input('First Name').props.onChangeText('Juan');
      input('Last Name').props.onChangeText('Dela Cruz');
      input('Email').props.onChangeText(' juan@example.com ');
      input('Subject').props.onChangeText('Hours');
      input('Message').props.onChangeText('Hello');
    });
  };
  const press = async (tree: ReactTestRenderer.ReactTestRenderer, label: string) => {
    const button = tree.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0];
    await ReactTestRenderer.act(async () => {
      await button.props.onPress();
    });
  };

  test('validation names the problem before anything is sent', async () => {
    expect(validateContact({ first_name: '', last_name: 'x', email: 'nope', subject: 'x', message: 'x' })).toEqual({
      first_name: 'First Name is required.',
      email: 'Enter a valid email address.',
    });
    const tree = await render(<GuestContactScreen navigation={navigation} />);
    await press(tree, 'Send Message');
    expect(mockPost).not.toHaveBeenCalled();
    expect(allText(tree.root)).toContain('Message is required.');
  });

  test('sends the trimmed message, confirms it, and can send another', async () => {
    mockPost.mockResolvedValue({ data: { message: 'Message sent' } });
    const tree = await render(<GuestContactScreen navigation={navigation} />);
    fill(tree);
    await press(tree, 'Send Message');

    expect(mockPost).toHaveBeenCalledWith('/contact', {
      first_name: 'Juan',
      last_name: 'Dela Cruz',
      email: 'juan@example.com',
      subject: 'Hours',
      message: 'Hello',
    });
    expect(allText(tree.root)).toContain('Message Sent!');

    await press(tree, 'Send Another');
    expect(allText(tree.root)).toContain('Send us a Message');
    expect(tree.root.find((node) => node.props.accessibilityLabel === 'Message' && node.props.onChangeText).props.value).toBe('');
  });

  test('a failure keeps what was typed and says why', async () => {
    const tree = await render(<GuestContactScreen navigation={navigation} />);
    fill(tree);

    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { errors: { email: ['The email must be valid.'] } } } });
    await press(tree, 'Send Message');
    expect(allText(tree.root)).toContain('The email must be valid.');

    mockPost.mockRejectedValueOnce({ isAxiosError: true });
    await press(tree, 'Send Message');
    expect(allText(tree.root)).toContain('You appear to be offline');

    mockPost.mockRejectedValueOnce({ response: { status: 503, data: { message: 'Your message could not be sent.' } } });
    await press(tree, 'Send Message');
    expect(allText(tree.root)).toContain('Your message could not be sent.');
    expect(allText(tree.root)).not.toContain('Message Sent!');
    expect(tree.root.find((node) => node.props.accessibilityLabel === 'Message' && node.props.onChangeText).props.value).toBe('Hello');
  });
});

describe('pages', () => {
  test('the dentist directory filters on the device and opens a profile', async () => {
    respond({
      '/dentists': { data: [API_DENTIST, { ...API_DENTIST, id: 5, name: 'Dr. Ben Cruz', rating: null }], meta: { last_page: 1 } },
    });
    jest.spyOn(repository, 'getSpecializations').mockResolvedValue([]);
    const tree = await render(<GuestDentistsScreen navigation={navigation} />);

    expect(allText(tree.root)).toContain('Dr. Ana Reyes');
    expect(allText(tree.root)).toContain('No reviews yet');

    ReactTestRenderer.act(() => {
      tree.root.find((node) => node.props.accessibilityLabel === 'Search dentist by name' && node.props.onChangeText).props.onChangeText('ben');
    });
    expect(allText(tree.root)).not.toContain('Dr. Ana Reyes');
    expect(allText(tree.root)).toContain('Dr. Ben Cruz');

    tree.root.findAll((node) => node.props.accessibilityLabel === 'View profile of Dr. Ben Cruz' && node.props.onPress)[0].props.onPress();
    expect(navigation.navigate).toHaveBeenCalledWith('GuestDentistProfile', { id: 5 });
  });

  test('a dentist profile shows credentials, hours and the clinic; booking asks guests to sign in', async () => {
    respond({ '/dentists/4': { data: API_DENTIST } });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const tree = await render(<GuestDentistProfileScreen navigation={navigation} route={{ params: { id: 4 } }} />);

    const text = allText(tree.root);
    expect(text).toContain('Accepting Patients');
    expect(text).toContain('DMD, Bukidnon State');
    expect(text).toContain('Mon–Tue');
    expect(text).toContain('Valencia Smiles');

    tree.root.findAll((node) => node.props.accessibilityLabel === 'Book Appointment' && node.props.onPress)[0].props.onPress();
    expect(alert).toHaveBeenCalledWith('Sign in to book', expect.any(String), expect.any(Array));
  });

  test('an unlisted dentist shows not found', async () => {
    respond({});
    const tree = await render(<GuestDentistProfileScreen navigation={navigation} route={{ params: { id: 99 } }} />);
    expect(allText(tree.root)).toContain('Dentist not found');
  });

  test('services show price ranges; only those clinics offer can be booked', async () => {
    respond({ '/services': { data: [API_SERVICE, { ...API_SERVICE, id: 2, name: 'Whitening', clinic_count: 0 }] } });
    const tree = await render(<GuestServicesScreen navigation={navigation} />);

    expect(allText(tree.root)).toContain('₱800 – ₱1,500');
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === 'Book Whitening')).toHaveLength(0);

    tree.root.findAll((node) => node.props.accessibilityLabel === 'Book Dental Cleaning' && node.props.onPress)[0].props.onPress();
    expect(navigation.navigate).toHaveBeenCalledWith('GuestClinics', { service: 'Dental Cleaning' });
  });

  test('about shows counted figures from the saved home page', async () => {
    mockCache['public:home'] = { stats: { verifiedClinics: 4, patients: 1250, municipalities: 3, satisfactionRate: 92 } };
    const tree = await render(<GuestAboutScreen navigation={navigation} />);
    const text = allText(tree.root);
    expect(text).toContain('1,250');
    expect(text).toContain('92%');
    expect(text).toContain('Our Core Values');
  });

  test.each([
    ['privacy', 'Privacy Policy'],
    ['terms', 'Terms of Service'],
    ['cookies', 'Cookie Policy'],
  ])('the footer’s %s page opens with its content', async (page, title) => {
    const tree = await render(<GuestLegalScreen navigation={navigation} route={{ params: { page } }} />);
    expect(allText(tree.root)).toContain(title);
  });
});
