import { fireEvent, render, screen, within } from '@testing-library/react';
import ProfilePage from './ProfilePage';
import { getAge } from '../utils/profile';

test('shows the profile header, tags, medical alert, and actions', () => {
  render(<ProfilePage />);
  expect(screen.getByRole('heading', { level: 1, name: 'My Profile' })).toBeInTheDocument();
  const nav = screen.getByRole('navigation', { name: 'Patient' });
  expect(within(nav).getByRole('link', { name: 'My Profile' })).toHaveAttribute(
    'aria-current',
    'page'
  );

  const header = screen.getByRole('region', { name: 'Profile summary' });
  expect(within(header).getByRole('heading', { name: 'Juan Dela Cruz' })).toBeInTheDocument();
  const tags = within(header).getByRole('list', { name: 'Health tags' });
  expect(within(tags).getAllByRole('listitem')).toHaveLength(3);
  expect(within(header).getByRole('link', { name: 'Edit Profile' })).toHaveAttribute(
    'href',
    '/patient/profile/edit'
  );
  expect(screen.getByText('Important Medical Alerts')).toBeInTheDocument();
});

test('overview shows personal, contact, and activity details', () => {
  render(<ProfilePage />);
  const personal = screen.getByRole('region', { name: 'Personal Information' });
  expect(personal).toHaveTextContent('March 15, 1995');
  expect(personal).toHaveTextContent(`${getAge('1995-03-15')} years old`);
  expect(personal).toHaveTextContent('O+');

  const contact = screen.getByRole('region', { name: 'Contact Details' });
  expect(contact).toHaveTextContent('juan@email.com');
  expect(contact).toHaveTextContent('8709');

  const activity = screen.getByRole('region', { name: 'Activity Summary' });
  expect(activity).toHaveTextContent('Total Appointments');
  expect(activity).toHaveTextContent('6');
});

test('other tabs list the recorded medical details', () => {
  render(<ProfilePage />);
  fireEvent.click(screen.getByRole('tab', { name: 'Medical History' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Diabetes (Type 2)');

  fireEvent.click(screen.getByRole('tab', { name: 'Allergies & Medications' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Penicillin');
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Amlodipine (5mg)');

  fireEvent.click(screen.getByRole('tab', { name: 'Emergency Contact' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('No emergency contact added yet.');
});

test('age counts only birthdays already reached', () => {
  expect(getAge('1995-03-15', new Date(2026, 2, 14))).toBe(30);
  expect(getAge('1995-03-15', new Date(2026, 2, 15))).toBe(31);
});
