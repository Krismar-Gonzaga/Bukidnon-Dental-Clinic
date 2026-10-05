/**
 * Offline-first layer: pure logic that runs without native SQLite.
 */
import { formatPrice, getOpenStatus } from '../src/utils/format';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => (key === 'user' ? JSON.stringify({ id: 7, name: 'Ana' }) : 'token')),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('../src/services/offline/database', () => ({
  getDatabase: jest.fn(),
  readCache: jest.fn(async () => null),
  writeCache: jest.fn(async () => undefined),
  deleteCacheByPrefix: jest.fn(),
}));
jest.mock('../src/services/offline/syncQueue', () => ({
  enqueue: jest.fn(async () => 42),
  getQueued: jest.fn(async () => []),
  removeQueued: jest.fn(),
  clearQueue: jest.fn(),
}));

const networkError = Object.assign(new Error('Network Error'), {
  isAxiosError: true,
  response: undefined,
});

describe('normalizeClinic', () => {
  const { normalizeClinic } = require('../src/services/offline/publicRepository');

  it('handles the /clinics/search model shape', () => {
    const clinic = normalizeClinic({
      id: 3,
      name: 'Valencia Ortho Center',
      address: 'Poblacion',
      city: 'Valencia City',
      province: 'Bukidnon',
      rating: '4.70',
      image: null,
      is_verified: true,
      opening_time: '08:00:00',
      closing_time: '17:00:00',
      specializations: [{ id: 2, name: 'Orthodontics', pivot: {} }],
    });
    expect(clinic.fullAddress).toBe('Poblacion, Valencia City, Bukidnon');
    expect(clinic.rating).toBe(4.7);
    expect(clinic.specializations).toEqual([{ id: 2, name: 'Orthodontics' }]);
    expect(clinic.image).toBeNull();
  });

  it('handles the /home featured shape (full address, names only, logo)', () => {
    const clinic = normalizeClinic({
      id: 1,
      name: 'Malaybalay Dental Care',
      address: 'Sayre Highway, Malaybalay City, Bukidnon',
      city: 'Malaybalay City',
      rating: '4.9',
      logo: 'https://example.com/a.jpg',
      specializations: ['General Dentistry'],
      is_verified: true,
    });
    expect(clinic.fullAddress).toBe('Sayre Highway, Malaybalay City, Bukidnon');
    expect(clinic.image).toBe('https://example.com/a.jpg');
    expect(clinic.specializations).toEqual([{ id: null, name: 'General Dentistry' }]);
  });
});

describe('format helpers', () => {
  it('formats peso prices', () => {
    expect(formatPrice(1500)).toBe('₱1,500');
  });

  it('computes open/closed from clinic hours', () => {
    const at = (h: number, m = 0) => new Date(2026, 9, 2, h, m);
    expect(getOpenStatus('08:00:00', '17:00:00', at(9))?.isOpen).toBe(true);
    expect(getOpenStatus('08:00:00', '17:00:00', at(17))?.isOpen).toBe(false);
    expect(getOpenStatus('08:00:00', '17:00:00', at(7, 59))?.label).toBe('Closed · opens 8:00 AM');
    expect(getOpenStatus(null, '17:00:00')).toBeNull();
  });
});

describe('offline patient writes', () => {
  const http = require('../src/services/http');
  const network = require('../src/services/offline/network');
  const queue = require('../src/services/offline/syncQueue');
  const { offlinePatientService } = require('../src/services/offline/patientRepository');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    network.setOnline(true);
  });

  it('queues a booking when the server is unreachable', async () => {
    jest.spyOn(http.default, 'request').mockRejectedValueOnce(networkError);
    const response = await offlinePatientService.createAppointment({ clinic_id: 1, reason: 'Cleaning' });
    expect(response.data.queued).toBe(true);
    expect(response.data.data.id).toBe('local-42');
    expect(queue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: '7', kind: 'appointment.create', method: 'POST' }),
    );
  });

  it('queues straight away when already known to be offline', async () => {
    network.setOnline(false);
    const request = jest.spyOn(http.default, 'request');
    await offlinePatientService.submitFeedback({ appointment_id: 5, rating: 5, comment: 'Great' });
    expect(request).not.toHaveBeenCalled();
    expect(queue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'feedback.create' }));
  });

  it('surfaces server validation errors instead of queueing them', async () => {
    const validationError = Object.assign(new Error('Unprocessable'), {
      isAxiosError: true,
      response: { status: 422, data: { message: 'Slot taken' } },
    });
    jest.spyOn(http.default, 'request').mockRejectedValueOnce(validationError);
    await expect(offlinePatientService.createAppointment({ clinic_id: 1 })).rejects.toBe(validationError);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('cancelling an unsynced booking just drops it from the queue', async () => {
    const request = jest.spyOn(http.default, 'request');
    await offlinePatientService.cancelAppointment('local-9');
    expect(queue.removeQueued).toHaveBeenCalledWith(9);
    expect(request).not.toHaveBeenCalled();
  });
});
