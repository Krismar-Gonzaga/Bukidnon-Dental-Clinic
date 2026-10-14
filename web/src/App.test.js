import { render, screen, within } from '@testing-library/react';
import App from './App';
import { CLINIC_MAP_MARKERS } from './mocks/clinicMapMarkers';
import { TESTIMONIALS } from './mocks/testimonials';

test('renders the guest home page hero and search panel', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', {
      level: 1,
      name: /find trusted dental clinics across bukidnon/i,
    })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('search', { name: /search dental clinics/i })
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('banner')).getByRole('link', { name: 'Home' })
  ).toHaveAttribute('aria-current', 'page');
});

test('renders the featured clinics section with clinic cards', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { level: 2, name: /featured clinics/i })
  ).toBeInTheDocument();
  expect(screen.getAllByRole('article').length).toBeGreaterThan(0);
  expect(
    screen.getAllByRole('button', { name: /book appointment/i }).length
  ).toBe(screen.getAllByRole('article').length);
});

test('renders the four dental specializations', () => {
  render(<App />);
  const section = screen
    .getByRole('heading', { level: 2, name: /dental specializations/i })
    .closest('section');
  ['Orthodontist', 'Pediatric Dentist', 'Oral Surgeon', 'General Dentist'].forEach(
    (name) => {
      expect(
        within(section).getByRole('heading', { level: 3, name })
      ).toBeInTheDocument();
    }
  );
});

test('renders the affordable care section with four priced services', () => {
  render(<App />);
  const section = screen
    .getByRole('heading', { level: 2, name: /affordable care for everyone/i })
    .closest('section');
  expect(within(section).getAllByRole('heading', { level: 3 })).toHaveLength(4);
  expect(within(section).getByText('Starts at ₱5,000')).toBeInTheDocument();
});

test('renders the why book section with three benefits', () => {
  render(<App />);
  const section = screen
    .getByRole('heading', {
      level: 2,
      name: /why book through bukidnondental\?/i,
    })
    .closest('section');
  ['Verified Clinics', 'Instant Online Booking', 'Smart Reminders'].forEach(
    (name) => {
      expect(
        within(section).getByRole('heading', { level: 3, name })
      ).toBeInTheDocument();
    }
  );
});

test('renders the find clinics near you section with map markers', () => {
  render(<App />);
  const section = screen
    .getByRole('heading', { level: 2, name: /find clinics near you/i })
    .closest('section');
  expect(
    within(section).getByRole('button', { name: /open full map/i })
  ).toBeInTheDocument();
  const markers = within(
    within(section).getByRole('list', { name: /clinic locations/i })
  ).getAllByRole('listitem');
  expect(markers).toHaveLength(CLINIC_MAP_MARKERS.length);
});

test('renders the testimonials section from mock data', () => {
  render(<App />);
  const section = screen
    .getByRole('heading', { level: 2, name: /what patients say/i })
    .closest('section');
  expect(within(section).getAllByRole('listitem')).toHaveLength(
    TESTIMONIALS.length
  );
  expect(
    within(section).getAllByRole('img', { name: /rated \d out of 5/i })
  ).toHaveLength(TESTIMONIALS.length);
});

test('renders the site footer with link groups and copyright', () => {
  render(<App />);
  const footer = screen.getByRole('contentinfo');
  expect(
    within(footer).getByRole('navigation', { name: 'Quick Links' })
  ).toBeInTheDocument();
  expect(
    within(footer).getByRole('navigation', { name: 'For Patients' })
  ).toBeInTheDocument();
  expect(
    within(footer).getByRole('heading', { level: 2, name: 'Contact' })
  ).toBeInTheDocument();
  expect(
    within(footer).getByText(/bukidnondental\. all rights reserved\./i)
  ).toBeInTheDocument();
});
