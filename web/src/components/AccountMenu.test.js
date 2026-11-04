import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import PatientLayout from '../layouts/PatientLayout';
import AdminLayout from '../layouts/AdminLayout';
import ClinicLayout from '../layouts/ClinicLayout';
import SiteHeader from './SiteHeader';
import { logout } from '../services/authService';
import { getNotifications } from '../services/notificationApi';
import { clinicUser, PATIENT_USER, renderWithProviders } from '../testUtils';

jest.mock('../services/authService', () => ({ fetchCurrentUser: jest.fn(), logout: jest.fn() }));
jest.mock('../services/notificationApi');

beforeEach(() => {
  getNotifications.mockResolvedValue({ notifications: [], unreadCount: 0, pageCount: 1 });
  logout.mockResolvedValue();
});

const openMenu = (name) => {
  const trigger = screen.getByRole('button', { name: `Account menu for ${name}` });
  fireEvent.click(trigger);
  return document.getElementById(trigger.getAttribute('aria-controls'));
};

test('patient portal: the sidebar has every page and Log Out; the avatar menu also has My Profile and Log Out', async () => {
  renderWithProviders(
    <PatientLayout title="Dashboard" activeHref="/patient/dashboard">
      <p>content</p>
    </PatientLayout>,
    { user: PATIENT_USER, route: '/patient/dashboard', path: '/patient/dashboard' }
  );

  const nav = screen.getByRole('navigation', { name: 'Patient' });
  expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
    'Dashboard',
    'Book Appointment',
    'Appointment History',
    'Notifications',
    'Find Clinics',
    'Saved Clinics',
    'Clinic Locator',
    'My Profile',
  ]);
  expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Notifications' })).toHaveAttribute('aria-expanded', 'false');

  const trigger = screen.getByRole('button', { name: 'Account menu for Juan Dela Cruz' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  const panel = openMenu('Juan Dela Cruz');
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(within(panel).getByRole('link', { name: 'My Profile' })).toHaveAttribute('href', '/patient/profile');

  fireEvent.click(within(panel).getByRole('button', { name: 'Log Out' }));
  await waitFor(() => expect(logout).toHaveBeenCalled());
  expect(await screen.findByText('Navigated away')).toBeInTheDocument();
});

test('the public header returns to Login and Register after logging out', async () => {
  renderWithProviders(<SiteHeader />, { user: PATIENT_USER });
  expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();

  fireEvent.click(within(openMenu('Juan Dela Cruz')).getByRole('button', { name: 'Log Out' }));

  await waitFor(() => expect(logout).toHaveBeenCalled());
  expect(await screen.findByRole('link', { name: 'Login' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Account menu for Juan Dela Cruz' })).not.toBeInTheDocument();
});

test('a failed logout says so and keeps the person signed in', async () => {
  logout.mockRejectedValue(new Error('offline'));
  renderWithProviders(<SiteHeader />, { user: PATIENT_USER });

  fireEvent.click(within(openMenu('Juan Dela Cruz')).getByRole('button', { name: 'Log Out' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('You are still signed in.');
  expect(screen.getByRole('button', { name: 'Account menu for Juan Dela Cruz' })).toBeInTheDocument();
});

test('Escape and outside clicks close the menu', () => {
  renderWithProviders(
    <PatientLayout title="Dashboard" activeHref="/patient/dashboard">
      <p>content</p>
    </PatientLayout>,
    { user: PATIENT_USER }
  );

  const trigger = screen.getByRole('button', { name: 'Account menu for Juan Dela Cruz' });
  openMenu('Juan Dela Cruz');
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(trigger).toHaveFocus();

  openMenu('Juan Dela Cruz');
  fireEvent.mouseDown(screen.getByText('content'));
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('admin and clinic portals link My Profile to their own profile pages', () => {
  const admin = { id: 3, name: 'Sam Admin', email: 'sam@example.com', role: 'system_admin', memberships: [] };
  const { unmount } = renderWithProviders(
    <AdminLayout title="Dashboard" activeHref="/admin">
      <p>content</p>
    </AdminLayout>,
    { user: admin }
  );
  const adminNav = screen.getByRole('navigation', { name: 'Administration' });
  ['Notifications', 'Change Password'].forEach((label) =>
    expect(within(adminNav).queryByRole('link', { name: label })).not.toBeInTheDocument()
  );
  expect(within(openMenu('Sam Admin')).getByRole('link', { name: 'My Profile' })).toHaveAttribute('href', '/admin/profile');
  unmount();

  renderWithProviders(
    <ClinicLayout section="dashboard" title="Dashboard">
      <p>content</p>
    </ClinicLayout>,
    { user: clinicUser(['clinic.view']), route: '/clinic/7/dashboard', path: '/clinic/:clinicId/dashboard' }
  );
  // Clinic sidebar: the design's System group. Settings needs a clinic permission.
  const clinicNav = screen.getByRole('navigation', { name: 'Clinic' });
  expect(within(clinicNav).getByRole('link', { name: 'Notifications' })).toHaveAttribute('href', '/clinic/7/notifications');
  ['Settings', 'Change Password'].forEach((label) =>
    expect(within(clinicNav).queryByRole('link', { name: label })).not.toBeInTheDocument()
  );
  expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  const menu = openMenu('Ana Reyes');
  expect(within(menu).getByRole('link', { name: 'My Profile' })).toHaveAttribute('href', '/clinic/7/profile');
  expect(within(menu).getByRole('link', { name: 'Notifications' })).toHaveAttribute('href', '/clinic/7/notifications');
  expect(within(menu).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/clinic/7/password');
});

test('public header: signed-in users get the avatar menu instead of Login/Register', () => {
  renderWithProviders(<SiteHeader />, { user: PATIENT_USER });

  expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
  const panel = openMenu('Juan Dela Cruz');
  expect(within(panel).getByRole('link', { name: 'My Dashboard' })).toHaveAttribute('href', '/patient/dashboard');
  expect(within(panel).getByRole('link', { name: 'My Profile' })).toHaveAttribute('href', '/patient/profile');
  expect(within(panel).getByRole('button', { name: 'Log Out' })).toBeInTheDocument();
});

test('on phones the sidebar opens from the menu button and closes with Escape or a link', () => {
  renderWithProviders(
    <PatientLayout title="Dashboard" activeHref="/patient/dashboard">
      <p>content</p>
    </PatientLayout>,
    { user: PATIENT_USER }
  );

  const menu = screen.getByRole('button', { name: 'Open menu' });
  expect(menu).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(menu);
  expect(menu).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(menu).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(menu);
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Patient' })).getByRole('link', { name: 'Find Clinics' }));
  expect(menu).toHaveAttribute('aria-expanded', 'false');
});
