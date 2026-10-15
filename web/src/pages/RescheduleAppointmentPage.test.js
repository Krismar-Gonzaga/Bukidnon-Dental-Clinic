import { fireEvent, screen } from '@testing-library/react';
import RescheduleAppointmentPage from './RescheduleAppointmentPage';
import { getAppointment, rescheduleAppointment } from '../services/patientApi';
import { getAvailability, getAvailableDates } from '../services/publicApi';
import { getNotifications } from '../services/notificationApi';
import { apiError, PATIENT_USER, renderWithProviders } from '../testUtils';
import { appointment, emptyNotifications } from '../testFixtures';
import { toDateKey } from '../utils/bookingCalendar';
import { businessTodayKey, dateFromKey } from '../utils/dateTime';

jest.mock('../services/patientApi');
jest.mock('../services/publicApi');
jest.mock('../services/notificationApi');

// An open date a few days from today (calendar shows the next 4 weeks).
const openDate = dateFromKey(businessTodayKey());
openDate.setDate(openDate.getDate() + 3);
const OPEN_KEY = toDateKey(openDate);
const SLOT = { startsAt: `${OPEN_KEY}T10:00:00+08:00`, label: '10:00 AM', dentistId: 5, branchId: 3 };

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  getAvailableDates.mockResolvedValue([OPEN_KEY]);
  getAvailability.mockResolvedValue([SLOT]);
});

const renderPage = () => renderWithProviders(<RescheduleAppointmentPage appointmentId="12" />, { user: PATIENT_USER });

const pickSlot = async () => {
  const day = await screen.findByRole('radio', { name: new RegExp(openDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })) });
  fireEvent.click(day);
  fireEvent.click(await screen.findByRole('radio', { name: '10:00 AM' }));
};

test('only dates the dentist works can be chosen, and times come from availability', async () => {
  getAppointment.mockResolvedValue(appointment({ status: 'confirmed' }));
  renderPage();

  expect(await screen.findByText(/Current appointment:/)).toHaveTextContent('November 3, 2026 at 9:00 AM');
  const unavailable = screen.getAllByRole('radio', { name: /\(unavailable\)/ });
  expect(unavailable.length).toBeGreaterThan(20);
  unavailable.forEach((radio) => expect(radio).toBeDisabled());

  await pickSlot();
  expect(getAvailability).toHaveBeenCalledWith({ clinicId: 7, serviceRateId: 9, dentistId: 5, date: OPEN_KEY });
});

test('a confirmed appointment sends a reschedule request', async () => {
  getAppointment.mockResolvedValue(appointment({ status: 'confirmed' }));
  rescheduleAppointment.mockResolvedValue({
    appointment: appointment({ status: 'reschedule_requested', requested_starts_at: SLOT.startsAt }),
    message: 'Reschedule request sent to the clinic',
  });
  renderPage();
  await pickSlot();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Reschedule' }));

  expect(await screen.findByRole('heading', { name: 'Reschedule Requested' })).toBeInTheDocument();
  expect(rescheduleAppointment).toHaveBeenCalledWith('12', SLOT.startsAt);
});

test('shows a conflict when the slot was just taken', async () => {
  getAppointment.mockResolvedValue(appointment({ status: 'pending' }));
  rescheduleAppointment.mockRejectedValue(apiError(409, { message: 'That time is not available. Please choose another slot.' }));
  renderPage();
  await pickSlot();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Reschedule' }));

  expect(await screen.findByText('That time is not available. Please choose another slot.')).toBeInTheDocument();
});

test('completed appointments cannot be rescheduled', async () => {
  getAppointment.mockResolvedValue(appointment({ status: 'completed' }));
  renderPage();

  expect(await screen.findByText('This appointment cannot be rescheduled online.')).toBeInTheDocument();
});
