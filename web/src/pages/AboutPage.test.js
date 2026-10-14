import { render, screen, within } from '@testing-library/react';
import AboutPage from './AboutPage';
import { ABOUT_STATS, ABOUT_VALUES } from '../mocks/aboutContent';

test('renders the hero heading and active nav link', () => {
  render(<AboutPage />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'About BukidnonDental' })
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('banner')).getByRole('link', { name: 'About' })
  ).toHaveAttribute('aria-current', 'page');
});

test('renders the mission copy and every stat', () => {
  render(<AboutPage />);
  expect(
    screen.getByRole('heading', { level: 2, name: 'Our Mission' })
  ).toBeInTheDocument();
  const stats = within(
    screen.getByRole('list', { name: /bukidnondental at a glance/i })
  ).getAllByRole('listitem');
  expect(stats).toHaveLength(ABOUT_STATS.length);
  ABOUT_STATS.forEach(({ value, label }) => {
    expect(screen.getByText(value)).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

test('renders every core value', () => {
  render(<AboutPage />);
  const section = screen
    .getByRole('heading', { level: 2, name: 'Our Core Values' })
    .closest('section');
  ABOUT_VALUES.forEach(({ title }) => {
    expect(
      within(section).getByRole('heading', { level: 3, name: title })
    ).toBeInTheDocument();
  });
});
