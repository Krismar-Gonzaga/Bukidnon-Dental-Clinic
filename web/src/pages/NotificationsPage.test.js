import { fireEvent, screen, waitFor } from '@testing-library/react';
import NotificationsPage from './NotificationsPage';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notificationApi';
import { PATIENT_USER, renderWithProviders } from '../testUtils';
import { notification } from '../testFixtures';

jest.mock('../services/notificationApi');

test('lists notifications and marks them read', async () => {
  getNotifications.mockResolvedValue({
    notifications: [notification(), notification({ id: 'n-2', title: 'Upcoming appointment', kind: 'reminder', read_at: '2026-10-01T00:00:00Z' })],
    unreadCount: 1,
    pageCount: 1,
  });
  markAllNotificationsRead.mockResolvedValue();
  markNotificationRead.mockResolvedValue();
  renderWithProviders(<NotificationsPage />, { user: PATIENT_USER });

  expect(await screen.findByRole('heading', { name: /Appointment confirmed/ })).toBeInTheDocument();
  expect(screen.getAllByText('2 hours ago')).toHaveLength(2);
  expect(screen.getByRole('status')).toHaveTextContent('1 unread notification');

  fireEvent.click(screen.getByRole('heading', { name: /Appointment confirmed/ }));
  await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith('n-1'));

  fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
  await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled());
});

test('shows the empty state', async () => {
  getNotifications.mockResolvedValue({ notifications: [], unreadCount: 0, pageCount: 1 });
  renderWithProviders(<NotificationsPage />, { user: PATIENT_USER });
  expect(await screen.findByText('You have no notifications yet.')).toBeInTheDocument();
});
