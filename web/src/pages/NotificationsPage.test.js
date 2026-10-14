import { fireEvent, render, screen, within } from '@testing-library/react';
import NotificationsPage from './NotificationsPage';
import { MOCK_NOTIFICATIONS } from '../mocks/notifications';

test('lists notifications with the unread count and active nav item', () => {
  render(<NotificationsPage />);
  expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
  const nav = screen.getByRole('navigation', { name: 'Patient' });
  expect(within(nav).getByRole('link', { name: 'Notifications' })).toHaveAttribute(
    'aria-current',
    'page'
  );

  expect(screen.getAllByRole('article')).toHaveLength(MOCK_NOTIFICATIONS.length);
  expect(screen.getByRole('status')).toHaveTextContent('2 unread notifications');
  expect(
    screen.getByRole('heading', { level: 2, name: 'Appointment Reminder (unread)' })
  ).toBeInTheDocument();
  expect(
    screen.getByText('Your profile information has been successfully updated.')
  ).toBeInTheDocument();
});

test('Mark all as read clears unread markers, the count, and the bell dot', () => {
  render(<NotificationsPage />);
  expect(screen.getByRole('link', { name: 'Notifications, unread items' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));

  expect(screen.getByRole('status')).toHaveTextContent('No unread notifications');
  expect(screen.queryByText(/\(unread\)/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Notifications, unread items' })
  ).not.toBeInTheDocument();
});

test('shows an empty message when there are no notifications', () => {
  render(<NotificationsPage initialNotifications={[]} />);
  expect(screen.getByText('You have no notifications yet.')).toBeInTheDocument();
});
