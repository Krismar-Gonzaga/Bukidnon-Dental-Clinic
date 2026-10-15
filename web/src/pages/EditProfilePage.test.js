import { fireEvent, render, screen } from '@testing-library/react';
import EditProfilePage from './EditProfilePage';

test('prefills the personal form from the profile', () => {
  render(<EditProfilePage />);
  expect(screen.getByRole('heading', { level: 1, name: 'Edit Profile' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Profile' })).toHaveAttribute(
    'href',
    '/patient/profile'
  );
  expect(screen.getByLabelText('First Name')).toHaveValue('Juan');
  expect(screen.getByLabelText('Last Name')).toHaveValue('Dela Cruz');
  expect(screen.getByLabelText('Email Address')).toHaveValue('juan@email.com');
  expect(screen.getByLabelText('Date of Birth')).toHaveValue('1995-03-15');
  expect(screen.getByLabelText('Gender')).toHaveValue('Male');
  expect(screen.getByLabelText('Blood Type')).toHaveValue('O+');
  expect(screen.getByLabelText('City / Municipality')).toHaveValue('Valencia City');
});

test('fields are editable; Save shows the Profile Updated screen', () => {
  render(<EditProfilePage />);
  expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/patient/profile');
  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Maria' } });
  expect(screen.getByLabelText('First Name')).toHaveValue('Maria');

  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  const heading = screen.getByRole('heading', { name: 'Profile Updated!' });
  expect(heading).toHaveFocus();
  expect(
    screen.getByText('Your profile information has been successfully saved.')
  ).toBeInTheDocument();
  expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();
  screen.getAllByRole('link', { name: 'Back to Profile' }).forEach((link) => {
    expect(link).toHaveAttribute('href', '/patient/profile');
  });
});

test('opens the tab named by initialTab, ignoring unknown ids', () => {
  const { unmount } = render(<EditProfilePage initialTab="emergency" />);
  expect(screen.getByRole('tab', { name: 'Emergency Contact' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  unmount();
  render(<EditProfilePage initialTab="nope" />);
  expect(screen.getByRole('tab', { name: 'Personal' })).toHaveAttribute('aria-selected', 'true');
});

test('undesigned tabs say editing is not available yet', () => {
  render(<EditProfilePage />);
  fireEvent.click(screen.getByRole('tab', { name: 'Medical History' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Editing this section is not available yet.');
});
