import { fireEvent, render, screen, within } from '@testing-library/react';
import ClinicLocatorPage from './ClinicLocatorPage';
import { LOCATOR_CLINICS } from '../mocks/clinicProfiles';

test('lists clinics with map pins and shows the first clinic selected', () => {
  render(<ClinicLocatorPage />);
  expect(screen.getByRole('heading', { level: 1, name: 'Clinic Locator' })).toBeInTheDocument();
  const list = screen.getByRole('list', { name: 'Clinics' });
  expect(within(list).getAllByRole('button')).toHaveLength(LOCATOR_CLINICS.length);
  expect(screen.getAllByRole('button', { name: /^Show .* on map$/ })).toHaveLength(
    LOCATOR_CLINICS.length
  );

  const selected = screen.getByRole('region', {
    name: 'Selected clinic: Braganza Dental Clinic',
  });
  expect(selected).toHaveTextContent('Sayre Highway, Valencia City, Bukidnon');
  expect(selected).toHaveTextContent('Mon–Sat 8AM–5PM');
  expect(within(selected).getByRole('link', { name: 'Details' })).toHaveAttribute(
    'href',
    '/patient/clinics/mock-dir-2'
  );
  expect(within(selected).getByRole('link', { name: 'Book' })).toHaveAttribute(
    'href',
    '/patient/book?clinic=mock-dir-2'
  );
});

test('picking a list item or a pin changes the selected clinic', () => {
  render(<ClinicLocatorPage />);
  const list = screen.getByRole('list', { name: 'Clinics' });
  fireEvent.click(within(list).getByRole('button', { name: /Maramag Dental Hub/ }));
  expect(
    screen.getByRole('region', { name: 'Selected clinic: Maramag Dental Hub' })
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Show Kitaotao Family Dental on map' }));
  expect(
    screen.getByRole('region', { name: 'Selected clinic: Kitaotao Family Dental' })
  ).toBeInTheDocument();
});

test('search filters the list and pins', () => {
  render(<ClinicLocatorPage />);
  const search = screen.getByRole('searchbox', { name: 'Search clinics' });
  fireEvent.change(search, { target: { value: 'valencia' } });
  expect(
    within(screen.getByRole('list', { name: 'Clinics' })).getAllByRole('button')
  ).toHaveLength(2);

  fireEvent.change(search, { target: { value: 'zzz' } });
  expect(screen.getByText('No clinics match your search.')).toBeInTheDocument();
});
