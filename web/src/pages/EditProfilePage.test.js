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

test('fields are editable; Save shows a not-connected notice', () => {
  render(<EditProfilePage />);
  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Maria' } });
  expect(screen.getByLabelText('First Name')).toHaveValue('Maria');

  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(screen.getByRole('status')).toHaveTextContent('not connected yet');

  expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/patient/profile');
});

test('undesigned tabs say editing is not available yet', () => {
  render(<EditProfilePage />);
  fireEvent.click(screen.getByRole('tab', { name: 'Medical History' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Editing this section is not available yet.');
});
