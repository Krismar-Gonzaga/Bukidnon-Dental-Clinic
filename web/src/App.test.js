import { render, screen } from '@testing-library/react';
import App from './App';

test('renders all Guest Homepage sections', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /find trusted dental clinics across bukidnon/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /featured clinics/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /dental specializations/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /what patients say/i })).toBeInTheDocument();
});
