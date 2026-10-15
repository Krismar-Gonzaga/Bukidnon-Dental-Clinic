import { fireEvent, render, screen, within } from '@testing-library/react';
import SavedClinicsPage from './SavedClinicsPage';

test('lists saved clinics with count, actions, and active nav item', () => {
  render(<SavedClinicsPage />);
  expect(screen.getByRole('heading', { level: 1, name: 'Saved Clinics' })).toBeInTheDocument();
  const nav = screen.getByRole('navigation', { name: 'Patient' });
  expect(within(nav).getByRole('link', { name: 'Saved Clinics' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  expect(screen.getByRole('status')).toHaveTextContent('3 saved clinics');
  expect(screen.getByRole('link', { name: 'Find More Clinics' })).toHaveAttribute(
    'href',
    '/patient/clinics'
  );

  const card = screen.getByRole('article', { name: 'Braganza Dental Clinic' });
  expect(card).toHaveTextContent('4.8 (120 reviews)');
  expect(within(card).getByRole('link', { name: 'Book' })).toHaveAttribute(
    'href',
    '/patient/book?clinic=mock-dir-2'
  );
  expect(within(card).getByRole('link', { name: 'Details' })).toHaveAttribute(
    'href',
    '/patient/clinics/mock-dir-2'
  );
});

test('the heart removes a clinic; an empty list shows a message', () => {
  render(<SavedClinicsPage initialSavedIds={['mock-dir-2']} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove Braganza Dental Clinic from saved clinics' })
  );
  expect(screen.getByRole('status')).toHaveTextContent('0 saved clinics');
  expect(screen.getByText(/You have no saved clinics yet/)).toBeInTheDocument();
});
