import { fireEvent, render, screen, within } from '@testing-library/react';
import ClinicDetailsPage from './ClinicDetailsPage';

test('shows the clinic banner, rating, signed-in header, and overview', () => {
  render(<ClinicDetailsPage clinicId="mock-dir-2" />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Braganza Dental Clinic' })
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('banner')).getByRole('link', { name: /My Account/ })
  ).toBeInTheDocument();
  expect(screen.getByText('4.8 (120 reviews)')).toBeInTheDocument();
  expect(screen.getAllByText('Sayre Highway, Valencia City, Bukidnon').length).toBeGreaterThan(0);
  expect(screen.getByText('Mon–Sat 8AM–5PM')).toBeInTheDocument();
  expect(screen.getByText('braganza@clinic.ph')).toBeInTheDocument();
  expect(within(screen.getByRole('main')).getByRole('link', { name: 'Book Appointment' })).toHaveAttribute(
    'href',
    '/patient/book?clinic=mock-dir-2'
  );
  expect(screen.getByRole('link', { name: 'Book Now' })).toHaveAttribute(
    'href',
    '/patient/book?clinic=mock-dir-2'
  );
  expect(screen.getByRole('link', { name: /Open in Maps/ })).toHaveAttribute('target', '_blank');
});

test('save toggles; tabs switch panels and support arrow keys', () => {
  render(<ClinicDetailsPage clinicId="mock-dir-2" />);
  const save = screen.getByRole('button', {
    name: 'Remove Braganza Dental Clinic from saved clinics',
  });
  expect(save).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(save);
  expect(screen.getByRole('button', { name: 'Save Braganza Dental Clinic' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );

  fireEvent.click(screen.getByRole('tab', { name: 'Dentists' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Dr. Maria Braganza');

  fireEvent.keyDown(screen.getByRole('tab', { name: 'Dentists' }), { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Services' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Services' })).toHaveFocus();

  fireEvent.click(screen.getByRole('tab', { name: 'Reviews' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('No reviews to show yet.');
});

test('clinics without extra details hide those rows; unknown ids show a message', () => {
  const { unmount } = render(<ClinicDetailsPage clinicId="mock-dir-1" />);
  expect(screen.queryByText('Operating Hours')).not.toBeInTheDocument();
  expect(screen.getAllByText('Valencia City, Bukidnon').length).toBeGreaterThan(0);
  unmount();

  render(<ClinicDetailsPage clinicId="nope" />);
  expect(screen.getByText('This clinic could not be found.')).toBeInTheDocument();
});
