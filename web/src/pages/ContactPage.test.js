import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { apiError, renderWithProviders as render } from '../testUtils';
import ContactPage from './ContactPage';
import App from '../App';
import { CONTACT_METHODS } from '../mocks/contactContent';
import { sendContactMessage } from '../services/publicApi';

jest.mock('../services/publicApi', () => ({
  ...jest.requireActual('../services/publicApi'),
  sendContactMessage: jest.fn(),
}));

const fill = () => {
  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Juan' } });
  fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Dela Cruz' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'juan@example.com' } });
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hours' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello' } });
};

test('renders the heading, contact details, and active nav link', () => {
  // The site header lives in App (shared by every public page).
  render(<App />, { route: '/contact' });
  expect(screen.getByRole('heading', { level: 1, name: 'Contact Us' })).toBeInTheDocument();
  const details = within(screen.getByRole('list', { name: /contact details/i })).getAllByRole('listitem');
  expect(details).toHaveLength(CONTACT_METHODS.length);
  expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Contact' })).toHaveAttribute('aria-current', 'page');
});

test('renders the message form with required fields', () => {
  render(<ContactPage />);
  ['First Name', 'Last Name', 'Email', 'Subject', 'Message'].forEach((label) => {
    expect(screen.getByLabelText(label)).toBeRequired();
  });
  expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
});

test('sends the message, confirms it and can send another', async () => {
  sendContactMessage.mockResolvedValue({ message: 'Message sent' });
  render(<ContactPage />);
  fill();
  fireEvent.submit(screen.getByRole('button', { name: /send message/i }));

  expect(await screen.findByRole('heading', { name: 'Message Sent!' })).toBeInTheDocument();
  expect(sendContactMessage).toHaveBeenCalledWith({ first_name: 'Juan', last_name: 'Dela Cruz', email: 'juan@example.com', subject: 'Hours', message: 'Hello', website: '' });

  fireEvent.click(screen.getByRole('button', { name: 'Send Another' }));
  expect(await screen.findByLabelText('Message')).toHaveValue('');
});

test('a failure keeps what was typed and shows why', async () => {
  sendContactMessage.mockRejectedValueOnce(apiError(422, { message: 'Invalid', errors: { email: ['The email must be valid.'] } }));
  render(<ContactPage />);
  fill();
  fireEvent.submit(screen.getByRole('button', { name: /send message/i }));

  expect(await screen.findByText('The email must be valid.')).toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('Hello');
  expect(screen.queryByRole('heading', { name: 'Message Sent!' })).not.toBeInTheDocument();

  sendContactMessage.mockRejectedValueOnce(apiError(503, { message: 'Your message could not be sent.' }));
  fireEvent.submit(screen.getByRole('button', { name: /send message/i }));
  await waitFor(() => expect(screen.getByText('Your message could not be sent.')).toBeInTheDocument());
});
