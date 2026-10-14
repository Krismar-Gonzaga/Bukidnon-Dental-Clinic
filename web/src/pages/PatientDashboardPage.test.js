import { render, screen, within } from '@testing-library/react';
import PatientDashboardPage from './PatientDashboardPage';
import {
  PATIENT_NAV_ITEMS,
  PATIENT_QUICK_ACTIONS,
} from '../config/patientNavigation';
import {
  MOCK_DASHBOARD_APPOINTMENTS,
  MOCK_DASHBOARD_STATS,
  MOCK_PATIENT,
} from '../mocks/patientDashboard';
import { getGreeting } from '../utils/patientDashboard';

test('renders the page title and sidebar navigation with Dashboard active', () => {
  render(<PatientDashboardPage />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Dashboard' })
  ).toBeInTheDocument();

  const nav = screen.getByRole('navigation', { name: 'Patient' });
  PATIENT_NAV_ITEMS.forEach(({ label }) => {
    expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
  });
  expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument();
});

test('welcome banner summarizes confirmed and pending appointments', () => {
  render(<PatientDashboardPage />);
  expect(
    screen.getByRole('heading', { level: 2, name: MOCK_PATIENT.name })
  ).toBeInTheDocument();
  expect(
    screen.getByText(/You have/).closest('p')
  ).toHaveTextContent(
    'You have 1 confirmed appointment and 1 pending approval.'
  );
});

test('renders a stat card per summary item', () => {
  render(<PatientDashboardPage />);
  const stats = screen.getByRole('region', { name: 'Summary' });
  MOCK_DASHBOARD_STATS.forEach(({ label }) => {
    expect(within(stats).getByText(label)).toBeInTheDocument();
  });
});

test('renders appointments with status-specific actions', () => {
  render(<PatientDashboardPage />);
  MOCK_DASHBOARD_APPOINTMENTS.forEach(({ service }) => {
    expect(
      screen.getByRole('button', { name: `View ${service}` })
    ).toBeInTheDocument();
  });
  expect(screen.getByText('Pending')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Reschedule Braces Consultation' })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Reschedule Root Canal Treatment' })
  ).not.toBeInTheDocument();
});

test('notifications panel shows the unread count', () => {
  render(<PatientDashboardPage />);
  const panel = screen.getByRole('region', { name: 'Notifications' });
  expect(within(panel).getByText('2')).toBeInTheDocument();
  expect(
    within(panel).getByRole('link', { name: 'View all notifications' })
  ).toBeInTheDocument();
});

test('greeting follows the time of day', () => {
  expect(getGreeting(new Date(2026, 0, 1, 8))).toBe('Good morning');
  expect(getGreeting(new Date(2026, 0, 1, 14))).toBe('Good afternoon');
  expect(getGreeting(new Date(2026, 0, 1, 20))).toBe('Good evening');
});

test('renders every quick action as a link', () => {
  render(<PatientDashboardPage />);
  const panel = screen.getByRole('region', { name: 'Quick Actions' });
  PATIENT_QUICK_ACTIONS.forEach(({ label, href }) => {
    expect(within(panel).getByRole('link', { name: label })).toHaveAttribute(
      'href',
      href
    );
  });
});
