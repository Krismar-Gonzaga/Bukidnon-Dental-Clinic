import { fireEvent, render, screen, within } from '@testing-library/react';
import BookAppointmentPage from './BookAppointmentPage';
import { BOOKING_STEPS } from '../config/booking';
import { BOOKING_CLINICS } from '../mocks/bookingClinics';
import { BOOKING_DENTISTS } from '../mocks/bookingDentists';
import { SERVICES } from '../mocks/services';
import {
  BOOKING_TIME_SLOTS,
  getBookingAvailableDates,
} from '../mocks/bookingSchedule';
import {
  getMondayFirstWeekday,
  getOpenTimeSlots,
  parseTimeSlot,
  toDateKey,
} from '../utils/bookingCalendar';

test('renders the title, active nav item, and stepper on the clinic step', () => {
  render(<BookAppointmentPage />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Book Appointment' })
  ).toBeInTheDocument();
  const nav = screen.getByRole('navigation', { name: 'Patient' });
  expect(
    within(nav).getByRole('link', { name: 'Book Appointment' })
  ).toHaveAttribute('aria-current', 'page');

  const stepper = screen.getByRole('list', { name: 'Booking steps' });
  expect(within(stepper).getAllByRole('listitem')).toHaveLength(
    BOOKING_STEPS.length
  );
  expect(within(stepper).getByText('Clinic').closest('li')).toHaveAttribute(
    'aria-current',
    'step'
  );
});

test('lists every mock clinic as a radio option', () => {
  render(<BookAppointmentPage />);
  const group = screen.getByRole('radiogroup', { name: 'Select a Clinic' });
  expect(within(group).getAllByRole('radio')).toHaveLength(BOOKING_CLINICS.length);
  BOOKING_CLINICS.forEach(({ name }) => {
    expect(within(group).getByText(name)).toBeInTheDocument();
  });
});

test('Next stays disabled until a clinic is selected', () => {
  render(<BookAppointmentPage />);
  const next = screen.getByRole('button', { name: 'Next: Select Dentist' });
  expect(next).toBeDisabled();

  const radio = screen.getByRole('radio', { name: /Braganza Dental Clinic/ });
  fireEvent.click(radio);
  expect(radio).toBeChecked();
  expect(next).toBeEnabled();
});

const goToDentistStep = () => {
  fireEvent.click(screen.getByRole('radio', { name: /Braganza Dental Clinic/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Select Dentist' }));
};

test('Next moves to the dentist step and marks Clinic completed', () => {
  render(<BookAppointmentPage />);
  goToDentistStep();

  expect(
    screen.getByRole('heading', { level: 2, name: 'Select a Dentist' })
  ).toHaveFocus();
  const stepper = screen.getByRole('list', { name: 'Booking steps' });
  expect(within(stepper).getByText('Clinic')).toHaveTextContent('(completed)');
  expect(within(stepper).getByText('Dentist').closest('li')).toHaveAttribute(
    'aria-current',
    'step'
  );

  const group = screen.getByRole('radiogroup', { name: 'Select a Dentist' });
  expect(within(group).getAllByRole('radio')).toHaveLength(BOOKING_DENTISTS.length);
});

test('unavailable dentists cannot be selected', () => {
  render(<BookAppointmentPage />);
  goToDentistStep();

  expect(screen.getByRole('radio', { name: /Dr\. Ana Cruz/ })).toBeDisabled();
  expect(screen.getByText('Unavailable')).toBeInTheDocument();

  const next = screen.getByRole('button', { name: 'Next: Select Service' });
  expect(next).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: /Dr\. Maria Braganza/ }));
  expect(next).toBeEnabled();
});

test('Back keeps the clinic; changing clinic clears the dentist', () => {
  render(<BookAppointmentPage />);
  goToDentistStep();
  fireEvent.click(screen.getByRole('radio', { name: /Dr\. Maria Braganza/ }));

  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('radio', { name: /Braganza Dental Clinic/ })).toBeChecked();

  fireEvent.click(screen.getByRole('radio', { name: /Valencia Smile Center/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Select Dentist' }));
  expect(screen.getByRole('radio', { name: /Dr\. Maria Braganza/ })).not.toBeChecked();
});

const goToServiceStep = () => {
  goToDentistStep();
  fireEvent.click(screen.getByRole('radio', { name: /Dr\. Maria Braganza/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Select Service' }));
};

test('service step lists every service with duration and price', () => {
  render(<BookAppointmentPage />);
  goToServiceStep();

  const group = screen.getByRole('radiogroup', { name: 'Select a Service' });
  expect(within(group).getAllByRole('radio')).toHaveLength(SERVICES.length);
  const braces = within(group).getByRole('radio', { name: /Braces Consultation/ });
  expect(braces.closest('label')).toHaveTextContent('30 min');
  expect(braces.closest('label')).toHaveTextContent('FREE – ₱500');

  const stepper = screen.getByRole('list', { name: 'Booking steps' });
  expect(within(stepper).getByText('Dentist')).toHaveTextContent('(completed)');
});

test('Next: Schedule enables after picking a service', () => {
  render(<BookAppointmentPage />);
  goToServiceStep();

  const next = screen.getByRole('button', { name: 'Next: Schedule' });
  expect(next).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: /Braces Consultation/ }));
  expect(next).toBeEnabled();
});

// Pin today to July 20, 2026 so the calendar matches the Figma sample.
const FIGMA_TODAY = new Date(2026, 6, 20, 9);
afterEach(() => jest.useRealTimers());

const goToScheduleStep = () => {
  goToServiceStep();
  fireEvent.click(screen.getByRole('radio', { name: /Braces Consultation/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Schedule' }));
};

test('schedule step shows the month, open dates, and time slots', () => {
  jest.useFakeTimers().setSystemTime(FIGMA_TODAY);
  render(<BookAppointmentPage />);
  goToScheduleStep();

  expect(
    screen.getByRole('heading', { level: 2, name: 'Choose Date & Time' })
  ).toHaveFocus();
  const dates = screen.getByRole('radiogroup', { name: 'July 2026' });
  expect(within(dates).getAllByRole('radio')).toHaveLength(
    12 // July 20-31
  );
  expect(
    within(dates).getByRole('radio', { name: 'Monday, July 27, 2026' })
  ).toBeInTheDocument();
  const times = screen.getByRole('radiogroup', { name: 'Available Time Slots' });
  expect(within(times).getAllByRole('radio')).toHaveLength(8);
});

test('Review Booking needs a date and a time; a new date clears the time', () => {
  jest.useFakeTimers().setSystemTime(FIGMA_TODAY);
  render(<BookAppointmentPage />);
  goToScheduleStep();

  const review = screen.getByRole('button', { name: 'Review Booking' });
  fireEvent.click(screen.getByRole('radio', { name: 'Monday, July 27, 2026' }));
  expect(review).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: '10:00 AM' }));
  expect(review).toBeEnabled();

  fireEvent.click(screen.getByRole('radio', { name: 'Tuesday, July 28, 2026' }));
  expect(screen.getByRole('radio', { name: '10:00 AM' })).not.toBeChecked();
  expect(review).toBeDisabled();
});

test('calendar helpers use local dates and Monday-first columns', () => {
  const monday = new Date(2026, 6, 20);
  expect(toDateKey(monday)).toBe('2026-07-20');
  expect(getMondayFirstWeekday(monday)).toBe(0);
  expect(getMondayFirstWeekday(new Date(2026, 6, 26))).toBe(6);
});

test('open dates run from today to the end of the month', () => {
  const midMonth = getBookingAvailableDates(new Date(2026, 6, 20));
  expect(midMonth.map(toDateKey)).toEqual(
    Array.from({ length: 12 }, (_, i) => `2026-07-${20 + i}`)
  );

  const firstDay = getBookingAvailableDates(new Date(2026, 7, 1));
  expect(firstDay).toHaveLength(31);
  expect(toDateKey(firstDay[0])).toBe('2026-08-01');

  const lastDay = getBookingAvailableDates(new Date(2026, 8, 30));
  expect(lastDay.map(toDateKey)).toEqual(['2026-09-30']);

  expect(getBookingAvailableDates(new Date(2027, 1, 1))).toHaveLength(28);
});

test('today hides time slots that have already started', () => {
  jest.useFakeTimers().setSystemTime(FIGMA_TODAY); // 9:00 AM
  render(<BookAppointmentPage />);
  goToScheduleStep();

  fireEvent.click(screen.getByRole('radio', { name: 'Monday, July 20, 2026' }));
  const times = screen.getByRole('radiogroup', { name: 'Available Time Slots' });
  expect(within(times).queryByRole('radio', { name: '8:00 AM' })).not.toBeInTheDocument();
  expect(within(times).queryByRole('radio', { name: '9:00 AM' })).not.toBeInTheDocument();
  expect(within(times).getAllByRole('radio')).toHaveLength(6);

  fireEvent.click(screen.getByRole('radio', { name: 'Tuesday, July 21, 2026' }));
  expect(
    within(screen.getByRole('radiogroup', { name: 'Available Time Slots' }))
      .getAllByRole('radio')
  ).toHaveLength(BOOKING_TIME_SLOTS.length);
});

test('slot helpers parse 12-hour labels and filter only today', () => {
  expect(parseTimeSlot('12:00 AM')).toBe(0);
  expect(parseTimeSlot('12:00 PM')).toBe(720);
  expect(parseTimeSlot('1:00 PM')).toBe(780);

  const now = new Date(2026, 6, 20, 10, 30);
  expect(getOpenTimeSlots(BOOKING_TIME_SLOTS, now, now)).toEqual([
    '11:00 AM',
    '1:00 PM',
    '2:00 PM',
    '3:00 PM',
    '4:00 PM',
  ]);
  expect(
    getOpenTimeSlots(BOOKING_TIME_SLOTS, new Date(2026, 6, 21), now)
  ).toEqual(BOOKING_TIME_SLOTS);
});

test('today drops off after its last slot; an ended month shows next month', () => {
  const lateToday = getBookingAvailableDates(new Date(2026, 6, 20, 16, 30));
  expect(toDateKey(lateToday[0])).toBe('2026-07-21');
  expect(lateToday).toHaveLength(11);

  const lateLastDay = getBookingAvailableDates(new Date(2026, 8, 30, 17));
  expect(lateLastDay).toHaveLength(31);
  expect(toDateKey(lateLastDay[0])).toBe('2026-10-01');
});

const reviewRow = (label) => screen.getByText(label, { selector: 'dt' }).nextSibling;

test('review step summarizes exactly what was picked', () => {
  jest.useFakeTimers().setSystemTime(FIGMA_TODAY);
  render(<BookAppointmentPage />);
  goToScheduleStep(); // Braganza Dental Clinic, Dr. Maria Braganza, Braces Consultation
  fireEvent.click(screen.getByRole('radio', { name: 'Monday, July 27, 2026' }));
  fireEvent.click(screen.getByRole('radio', { name: '10:00 AM' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review Booking' }));

  expect(
    screen.getByRole('heading', { level: 2, name: 'Review Your Booking' })
  ).toHaveFocus();
  expect(reviewRow('Clinic')).toHaveTextContent('Braganza Dental Clinic');
  expect(reviewRow('Dentist')).toHaveTextContent('Dr. Maria Braganza');
  expect(reviewRow('Service')).toHaveTextContent('Braces Consultation');
  expect(reviewRow('Date')).toHaveTextContent('July 27, 2026');
  expect(reviewRow('Time')).toHaveTextContent('10:00 AM');
  expect(reviewRow('Estimated Cost')).toHaveTextContent('FREE – ₱500');
  expect(screen.getByText(/arrive 10 minutes before/)).toBeInTheDocument();
});

test('review reflects different picks and confirm shows the request-sent screen', () => {
  jest.useFakeTimers().setSystemTime(FIGMA_TODAY);
  render(<BookAppointmentPage />);
  fireEvent.click(screen.getByRole('radio', { name: /Valencia Smile Center/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Select Dentist' }));
  fireEvent.click(screen.getByRole('radio', { name: /Dr\. Jose Santos/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Select Service' }));
  fireEvent.click(screen.getByRole('radio', { name: /Dental Cleaning/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Next: Schedule' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Friday, July 31, 2026' }));
  fireEvent.click(screen.getByRole('radio', { name: '2:00 PM' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review Booking' }));

  expect(reviewRow('Clinic')).toHaveTextContent('Valencia Smile Center');
  expect(reviewRow('Dentist')).toHaveTextContent('Dr. Jose Santos');
  expect(reviewRow('Service')).toHaveTextContent('Dental Cleaning');
  expect(reviewRow('Date')).toHaveTextContent('July 31, 2026');
  expect(reviewRow('Time')).toHaveTextContent('2:00 PM');
  expect(reviewRow('Estimated Cost')).toHaveTextContent('₱500 – ₱1,500');

  fireEvent.click(screen.getByRole('button', { name: 'Confirm Appointment' }));

  expect(
    screen.getByRole('heading', { level: 1, name: 'Booking Submitted' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { level: 2, name: 'Appointment Request Sent!' })
  ).toHaveFocus();
  expect(screen.getByText('Pending')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Booking steps' })).not.toBeInTheDocument();

  expect(reviewRow('Clinic')).toHaveTextContent('Valencia Smile Center');
  expect(reviewRow('Dentist')).toHaveTextContent('Dr. Jose Santos');
  expect(reviewRow('Service')).toHaveTextContent('Dental Cleaning');
  expect(reviewRow('Requested Date')).toHaveTextContent('July 31, 2026');
  expect(reviewRow('Requested Time')).toHaveTextContent('2:00 PM');
  expect(screen.queryByText('Estimated Cost')).not.toBeInTheDocument();
  expect(screen.getByText(/must approve your request/)).toBeInTheDocument();

  const card = screen.getByRole('region', { name: 'Appointment Request Sent!' });
  expect(within(card).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
    'href',
    '/patient/dashboard'
  );
  expect(within(card).getByRole('link', { name: 'View Appointments' })).toHaveAttribute(
    'href',
    '/patient/appointments'
  );
});

test('?clinic preselects a bookable clinic and ignores unknown ones', () => {
  const { unmount } = render(<BookAppointmentPage initialClinicId="mock-dir-2" />);
  expect(screen.getByRole('radio', { name: /Braganza Dental Clinic/ })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Next: Select Dentist' })).toBeEnabled();
  unmount();

  render(<BookAppointmentPage initialClinicId="mock-dir-99" />);
  expect(screen.getByRole('button', { name: 'Next: Select Dentist' })).toBeDisabled();
});
