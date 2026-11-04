import { fireEvent, screen } from '@testing-library/react';
import BookAppointmentPage from './BookAppointmentPage';
import { bookAppointment } from '../services/patientApi';
import { getAvailability, getAvailableDates, getClinic, searchClinics } from '../services/publicApi';
import { getNotifications } from '../services/notificationApi';
import { apiError, PATIENT_USER, renderWithProviders } from '../testUtils';
import { appointment, clinicProfile, clinicSummary, emptyNotifications } from '../testFixtures';
import { toDateKey } from '../utils/bookingCalendar';
import { businessTodayKey, dateFromKey } from '../utils/dateTime';

jest.mock('../services/patientApi');
jest.mock('../services/publicApi');
jest.mock('../services/notificationApi');

const openDate = dateFromKey(businessTodayKey());
openDate.setDate(openDate.getDate() + 2);
const OPEN_KEY = toDateKey(openDate);
const SLOT = { startsAt: `${OPEN_KEY}T09:00:00+08:00`, label: '9:00 AM', dentistId: 5, branchId: 3 };
const dayName = openDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  searchClinics.mockResolvedValue({ clinics: [clinicSummary()], total: 1, pageCount: 1, currentPage: 1 });
  getClinic.mockResolvedValue(clinicProfile());
  getAvailableDates.mockResolvedValue([OPEN_KEY]);
  getAvailability.mockResolvedValue([SLOT]);
});

const next = (label) => fireEvent.click(screen.getByRole('button', { name: label }));

async function walkToConfirm() {
  fireEvent.click(await screen.findByRole('radio', { name: /Valencia Smiles/ }));
  next('Next: Select Dentist');
  fireEvent.click(await screen.findByRole('radio', { name: /Dr. Maria Santos/ }));
  next('Next: Select Service');
  fireEvent.click(screen.getByRole('radio', { name: /Dental Cleaning/ }));
  next('Next: Schedule');
  fireEvent.click(await screen.findByRole('radio', { name: new RegExp(dayName) }));
  fireEvent.click(await screen.findByRole('radio', { name: '9:00 AM' }));
  next('Review Booking');
}

test('books through every step with live clinic data and an idempotency key', async () => {
  bookAppointment.mockResolvedValue(appointment({ starts_at: SLOT.startsAt }));
  renderWithProviders(<BookAppointmentPage />, { user: PATIENT_USER });

  await walkToConfirm();
  expect(screen.getByText('₱800')).toBeInTheDocument();
  next('Confirm Appointment');

  expect(await screen.findByText('#000012')).toBeInTheDocument();
  const [payload, key] = bookAppointment.mock.calls[0];
  expect(payload).toEqual({ clinicId: '7', serviceRateId: '9', dentistId: '5', branchId: 3, startsAt: SLOT.startsAt });
  expect(key).toEqual(expect.any(String));
  expect(key.length).toBeGreaterThan(8);
});

test('preselects the clinic from ?clinic=', async () => {
  renderWithProviders(<BookAppointmentPage />, { user: PATIENT_USER, route: '/patient/book?clinic=7' });
  expect(await screen.findByRole('radio', { name: /Valencia Smiles/ })).toBeChecked();
});

test('a slot taken meanwhile sends the patient back to choose another time', async () => {
  bookAppointment.mockRejectedValue(apiError(409, { message: 'That time was just booked. Please choose another slot.' }));
  renderWithProviders(<BookAppointmentPage />, { user: PATIENT_USER });

  await walkToConfirm();
  next('Confirm Appointment');

  expect(await screen.findByText('That time was just booked. Please choose another slot.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Choose Date & Time' })).toBeInTheDocument();
  expect(getAvailability.mock.calls.length).toBeGreaterThan(1); // slots refreshed
});

test('explains when a clinic has no dentists yet', async () => {
  getClinic.mockResolvedValue(clinicProfile({ dentists: [] }));
  renderWithProviders(<BookAppointmentPage />, { user: PATIENT_USER });

  fireEvent.click(await screen.findByRole('radio', { name: /Valencia Smiles/ }));
  next('Next: Select Dentist');
  expect(await screen.findByText('This clinic has no dentists accepting online bookings yet.')).toBeInTheDocument();
});
