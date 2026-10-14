import { fireEvent, render, screen, within } from '@testing-library/react';
import FindClinicsPage from './FindClinicsPage';
import { CLINICS_PER_PAGE } from '../config/clinicDirectory';
import { DIRECTORY_CLINICS } from '../mocks/directoryClinics';

const getCards = () => screen.queryAllByRole('article');

test('renders the directory heading, filters, and active nav link', () => {
  render(<FindClinicsPage />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Clinic Directory' })
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Search Clinic')).toBeInTheDocument();
  expect(screen.getByLabelText('Location')).toBeInTheDocument();
  expect(screen.getByLabelText('Specialization')).toBeInTheDocument();
  expect(screen.getByLabelText('Sort By')).toBeInTheDocument();
  expect(
    within(screen.getByRole('banner')).getByRole('link', { name: 'Find Clinics' })
  ).toHaveAttribute('aria-current', 'page');
});

test('shows the result count and the first page of clinics', () => {
  render(<FindClinicsPage />);
  expect(
    screen.getByText(`${DIRECTORY_CLINICS.length} clinics found`)
  ).toBeInTheDocument();
  expect(getCards()).toHaveLength(CLINICS_PER_PAGE);
  expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
    'aria-current',
    'page'
  );
});

test('sorts by highest rating by default', () => {
  render(<FindClinicsPage />);
  const topRated = [...DIRECTORY_CLINICS].sort((a, b) => b.rating - a.rating)[0];
  expect(within(getCards()[0]).getByRole('heading')).toHaveTextContent(
    topRated.name
  );
});

test('filters clinics by name search', () => {
  render(<FindClinicsPage />);
  fireEvent.change(screen.getByLabelText('Search Clinic'), {
    target: { value: 'braganza' },
  });
  expect(screen.getByText('1 clinic found')).toBeInTheDocument();
  expect(getCards()).toHaveLength(1);
  expect(
    screen.queryByRole('navigation', { name: /clinic results pages/i })
  ).not.toBeInTheDocument();
});

test('filters clinics by location and specialization', () => {
  render(<FindClinicsPage />);
  fireEvent.change(screen.getByLabelText('Location'), {
    target: { value: 'Valencia City' },
  });
  fireEvent.change(screen.getByLabelText('Specialization'), {
    target: { value: 'Implants' },
  });
  const expected = DIRECTORY_CLINICS.filter(
    (clinic) =>
      clinic.location === 'Valencia City' &&
      clinic.specializations.includes('Implants')
  );
  expect(getCards()).toHaveLength(expected.length);
});

test('shows an empty state when nothing matches', () => {
  render(<FindClinicsPage />);
  fireEvent.change(screen.getByLabelText('Search Clinic'), {
    target: { value: 'no such clinic' },
  });
  expect(screen.getByText('0 clinics found')).toBeInTheDocument();
  expect(screen.getByText(/no clinics match your search/i)).toBeInTheDocument();
});

test('paginates results', () => {
  render(<FindClinicsPage />);
  const firstPageNames = getCards().map((card) => card.textContent);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  expect(getCards()[0].textContent).not.toBe(firstPageNames[0]);
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
});
