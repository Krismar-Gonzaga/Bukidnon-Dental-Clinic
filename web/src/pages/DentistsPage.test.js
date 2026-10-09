import { fireEvent, render, screen, within } from '@testing-library/react';
import DentistsPage from './DentistsPage';
import { DIRECTORY_DENTISTS } from '../mocks/directoryDentists';

const getCards = () => screen.queryAllByRole('article');

test('renders the directory heading, filters, and active nav link', () => {
  render(<DentistsPage />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Dentist Directory' })
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Search dentist')).toBeInTheDocument();
  expect(screen.getByLabelText('Specialization')).toBeInTheDocument();
  expect(
    within(screen.getByRole('banner')).getByRole('link', { name: 'Dentists' })
  ).toHaveAttribute('aria-current', 'page');
});

test('renders a card per dentist with clinic, rating, and availability', () => {
  render(<DentistsPage />);
  expect(getCards()).toHaveLength(DIRECTORY_DENTISTS.length);

  const firstCard = getCards()[0];
  expect(
    within(firstCard).getByRole('heading', { name: 'Dr. Maria Braganza' })
  ).toBeInTheDocument();
  expect(within(firstCard).getByText('Braganza Dental Clinic')).toBeInTheDocument();
  expect(
    within(firstCard).getByRole('img', { name: 'Rated 4.9 out of 5' })
  ).toBeInTheDocument();
  expect(within(firstCard).getByText('12 years exp.')).toBeInTheDocument();
  expect(within(firstCard).getByText('Available')).toBeInTheDocument();
  expect(
    within(firstCard).getByRole('button', { name: 'View Profile' })
  ).toBeInTheDocument();

  expect(screen.getAllByText('Unavailable')).toHaveLength(
    DIRECTORY_DENTISTS.filter((dentist) => !dentist.available).length
  );
});

test('filters dentists by name search', () => {
  render(<DentistsPage />);
  fireEvent.change(screen.getByLabelText('Search dentist'), {
    target: { value: 'santos' },
  });
  expect(screen.getByRole('status')).toHaveTextContent('1 dentist found');
  expect(getCards()).toHaveLength(1);
});

test('filters dentists by specialization', () => {
  render(<DentistsPage />);
  fireEvent.change(screen.getByLabelText('Specialization'), {
    target: { value: 'Orthodontist' },
  });
  expect(getCards()).toHaveLength(
    DIRECTORY_DENTISTS.filter((dentist) => dentist.specialty === 'Orthodontist')
      .length
  );
});

test('shows an empty state when nothing matches', () => {
  render(<DentistsPage />);
  fireEvent.change(screen.getByLabelText('Search dentist'), {
    target: { value: 'no such dentist' },
  });
  expect(getCards()).toHaveLength(0);
  expect(screen.getByText(/no dentists match your search/i)).toBeInTheDocument();
});

test('hides pagination when all dentists fit on one page', () => {
  render(<DentistsPage />);
  expect(
    screen.queryByRole('navigation', { name: /dentist results pages/i })
  ).not.toBeInTheDocument();
});
