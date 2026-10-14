import { fireEvent, render, screen, within } from '@testing-library/react';
import AppointmentHistoryPage from './AppointmentHistoryPage';
import { APPOINTMENT_FILTERS } from '../config/appointments';
import { MOCK_APPOINTMENT_HISTORY } from '../mocks/appointmentHistory';

const getCards = () => screen.queryAllByRole('article');

test('renders the title, active nav item, and all appointments by default', () => {
  render(<AppointmentHistoryPage />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Appointment History' })
  ).toBeInTheDocument();
  const nav = screen.getByRole('navigation', { name: 'Patient' });
  expect(
    within(nav).getByRole('link', { name: 'Appointment History' })
  ).toHaveAttribute('aria-current', 'page');

  const filters = screen.getByRole('group', { name: 'Filter appointments by status' });
  APPOINTMENT_FILTERS.forEach(({ label }) => {
    expect(within(filters).getByRole('button', { name: label })).toBeInTheDocument();
  });
  expect(within(filters).getByRole('button', { name: 'All' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(getCards()).toHaveLength(MOCK_APPOINTMENT_HISTORY.length);
});

test('filter chips show only matching appointments', () => {
  render(<AppointmentHistoryPage />);
  const filters = screen.getByRole('group', { name: 'Filter appointments by status' });

  fireEvent.click(within(filters).getByRole('button', { name: 'Completed' }));
  const expected = MOCK_APPOINTMENT_HISTORY.filter(({ status }) => status === 'completed');
  expect(getCards()).toHaveLength(expected.length);
  getCards().forEach((card) => expect(card).toHaveTextContent('Completed'));

  fireEvent.click(within(filters).getByRole('button', { name: 'Cancelled' }));
  expect(getCards()).toHaveLength(1);
  expect(getCards()[0]).toHaveTextContent('Tooth Extraction');
});

test('actions depend on the appointment status', () => {
  render(<AppointmentHistoryPage />);
  const [pending, upcoming, completed, , cancelled] = getCards();

  expect(pending).toHaveTextContent('Awaiting Approval');
  expect(within(pending).queryAllByRole('button')).toHaveLength(0);
  expect(within(pending).getByRole('link', { name: /^View/ })).toBeInTheDocument();

  expect(within(upcoming).getByRole('link', { name: /^Reschedule/ })).toHaveAttribute(
    'href',
    '/patient/appointments/hist-2/reschedule'
  );
  expect(within(completed).getByRole('link', { name: /^Review/ })).toHaveAttribute(
    'href',
    '/patient/reviews?appointment=hist-3'
  );

  expect(within(cancelled).queryAllByRole('button')).toHaveLength(0);
  expect(within(cancelled).getByRole('link', { name: /^View/ })).toBeInTheDocument();
});

test('View links to the appointment details page', () => {
  render(<AppointmentHistoryPage />);
  const [pending] = getCards();
  expect(within(pending).getByRole('link', { name: /^View Root Canal Treatment/ })).toHaveAttribute(
    'href',
    '/patient/appointments/hist-1'
  );
});
