import { screen, within } from '@testing-library/react';
import { renderWithProviders as render } from '../testUtils';
import AboutPage, { aboutStats } from './AboutPage';
import App from '../App';
import { ABOUT_VALUES } from '../mocks/aboutContent';
import { getHome } from '../services/publicApi';

jest.mock('../services/publicApi', () => ({
  ...jest.requireActual('../services/publicApi'),
  getHome: jest.fn(),
}));

beforeEach(() => {
  getHome.mockResolvedValue({ stats: { verified_clinics: 4, patients: 1250, satisfaction_rate: 92, municipalities: 3 }, featuredClinics: [], reviews: [], specializations: [] });
});

test('renders the hero heading and active nav link', () => {
  // The site header lives in App (shared by every public page).
  render(<App />, { route: '/about' });
  expect(screen.getByRole('heading', { level: 1, name: 'About BukidnonDental' })).toBeInTheDocument();
  expect(within(screen.getByRole('banner')).getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
});

test('renders the mission copy and figures counted from the API', async () => {
  render(<AboutPage />);
  expect(screen.getByRole('heading', { level: 2, name: 'Our Mission' })).toBeInTheDocument();
  expect(await screen.findByText('1,250')).toBeInTheDocument();
  expect(screen.getByText('92%')).toBeInTheDocument();
  expect(screen.getByText('Partner Clinics')).toBeInTheDocument();
});

test('figures that are not known yet show a dash, never a sample number', () => {
  expect(aboutStats(undefined).map(({ value }) => value)).toEqual(['—', '—', '—', '—']);
  expect(aboutStats({ verified_clinics: 0, patients: 0, satisfaction_rate: null, municipalities: 0 })[2].value).toBe('—');
});

test('renders every core value', () => {
  render(<AboutPage />);
  const section = screen.getByRole('heading', { level: 2, name: 'Our Core Values' }).closest('section');
  ABOUT_VALUES.forEach(({ title }) => {
    expect(within(section).getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
  });
});
