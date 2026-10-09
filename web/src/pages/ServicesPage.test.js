import { fireEvent, render, screen, within } from '@testing-library/react';
import ServicesPage from './ServicesPage';
import { SERVICES } from '../mocks/services';

const getCards = () => screen.queryAllByRole('article');

test('renders the heading, category filter, and active nav link', () => {
  render(<ServicesPage />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Affordable Care for Everyone' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('group', { name: /filter services by category/i })
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(
    within(screen.getByRole('banner')).getByRole('link', { name: 'Services' })
  ).toHaveAttribute('aria-current', 'page');
});

test('renders every service with price, duration, and booking action', () => {
  render(<ServicesPage />);
  expect(getCards()).toHaveLength(SERVICES.length);

  const firstCard = getCards()[0];
  expect(
    within(firstCard).getByRole('heading', { name: 'Dental Cleaning' })
  ).toBeInTheDocument();
  expect(within(firstCard).getByText('Preventive')).toBeInTheDocument();
  expect(within(firstCard).getByText('₱500 – ₱1,500')).toBeInTheDocument();
  expect(within(firstCard).getByText('45–60 min')).toBeInTheDocument();
  expect(
    within(firstCard).getByRole('button', { name: 'Book This Service' })
  ).toBeInTheDocument();
});

test('filters services by category', () => {
  render(<ServicesPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Restorative' }));

  const expected = SERVICES.filter((service) => service.category === 'Restorative');
  expect(getCards()).toHaveLength(expected.length);
  expect(screen.getByRole('button', { name: 'Restorative' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    `${expected.length} services shown`
  );

  fireEvent.click(screen.getByRole('button', { name: 'All' }));
  expect(getCards()).toHaveLength(SERVICES.length);
});
