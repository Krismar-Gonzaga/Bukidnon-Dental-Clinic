import { render, screen, within } from '@testing-library/react';
import PatientFindClinicsPage from './PatientFindClinicsPage';
import FindClinicsPage from './FindClinicsPage';

test('patient view shows My Account instead of Login and Register', () => {
  render(<PatientFindClinicsPage />);
  const header = screen.getByRole('banner');
  expect(within(header).getByRole('link', { name: /My Account/ })).toHaveAttribute(
    'href',
    '/patient/dashboard'
  );
  expect(within(header).queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
  expect(within(header).queryByRole('link', { name: 'Register' })).not.toBeInTheDocument();
  expect(
    screen.getByRole('heading', { level: 1, name: 'Clinic Directory' })
  ).toBeInTheDocument();
});

test('patient view links Book Appointment to booking with the clinic preselected', () => {
  render(<PatientFindClinicsPage />);
  const card = screen.getByRole('article', { name: 'Valencia Smile Center' });
  expect(within(card).getByRole('link', { name: 'Book Appointment' })).toHaveAttribute(
    'href',
    '/patient/book?clinic=mock-dir-1'
  );
  expect(within(card).getByRole('link', { name: 'View Details' })).toHaveAttribute(
    'href',
    '/patient/clinics/mock-dir-1'
  );
});

test('public view keeps Login and Register', () => {
  render(<FindClinicsPage />);
  const header = screen.getByRole('banner');
  expect(within(header).getByRole('link', { name: 'Login' })).toBeInTheDocument();
  expect(within(header).queryByRole('link', { name: /My Account/ })).not.toBeInTheDocument();
});
