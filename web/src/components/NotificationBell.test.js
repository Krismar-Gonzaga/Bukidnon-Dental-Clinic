import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notificationApi';
import { clinicUser, PATIENT_USER, renderWithProviders } from '../testUtils';
import { getNotificationHref } from '../utils/notificationLinks';

jest.mock('../services/notificationApi');

const item = (overrides = {}) => ({
  id: 'n1',
  type: 'confirmed',
  title: 'Appointment confirmed',
  message: 'Your cleaning on Nov 3 is confirmed.',
  time: '2h ago',
  unread: true,
  resource: { type: 'appointment', id: 12 },
  ...overrides,
});

beforeEach(() => {
  getNotifications.mockResolvedValue({
    notifications: [item(), item({ id: 'n2', title: 'Reminder', unread: false, resource: null })],
    unreadCount: 1,
    pageCount: 1,
  });
  markNotificationRead.mockResolvedValue();
  markAllNotificationsRead.mockResolvedValue();
});

const renderBell = () =>
  renderWithProviders(
    <Routes>
      <Route path="/patient/dashboard" element={<NotificationBell allHref="/patient/notifications" />} />
      <Route path="/patient/appointments/:id" element={<p>Appointment page</p>} />
    </Routes>,
    { user: PATIENT_USER, route: '/patient/dashboard' }
  );

test('bell opens a dropdown of recent notifications with a link to all', async () => {
  renderBell();

  const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
  fireEvent.click(bell);
  expect(bell).toHaveAttribute('aria-expanded', 'true');

  expect(await screen.findByRole('button', { name: /Appointment confirmed \(unread\)/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Reminder/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View all notifications' })).toHaveAttribute('href', '/patient/notifications');

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('link', { name: 'View all notifications' })).not.toBeInTheDocument();
});

test('choosing a notification marks it read and opens its page', async () => {
  renderBell();

  fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  fireEvent.click(await screen.findByRole('button', { name: /Appointment confirmed/ }));

  await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith('n1'));
  expect(await screen.findByText('Appointment page')).toBeInTheDocument();
});

test('mark all as read', async () => {
  renderBell();

  fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
  const panel = (await screen.findByRole('link', { name: 'View all notifications' })).parentElement;
  fireEvent.click(within(panel).getByRole('button', { name: 'Mark all as read' }));

  await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled());
});

test('notification links depend on the resource and the user', () => {
  expect(getNotificationHref(item(), PATIENT_USER)).toBe('/patient/appointments/12');
  const staff = clinicUser(['clinic.view']);
  expect(getNotificationHref(item({ resource: { type: 'clinic_appointment', id: 5, clinic_id: 7 } }), staff)).toBe(
    '/clinic/7/appointments/5'
  );
  expect(getNotificationHref(item({ resource: { type: 'inventory_alerts', clinic_id: 7 } }), staff)).toBe('/clinic/7/inventory');
  expect(getNotificationHref(item({ resource: null }), PATIENT_USER)).toBeNull();
});
