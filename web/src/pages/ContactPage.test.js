import { fireEvent, render, screen, within } from '@testing-library/react';
import ContactPage from './ContactPage';
import { CONTACT_METHODS } from '../mocks/contactContent';

test('renders the heading, contact details, and active nav link', () => {
  render(<ContactPage />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Contact Us' })
  ).toBeInTheDocument();
  const details = within(
    screen.getByRole('list', { name: /contact details/i })
  ).getAllByRole('listitem');
  expect(details).toHaveLength(CONTACT_METHODS.length);
  expect(
    within(screen.getByRole('banner')).getByRole('link', { name: 'Contact' })
  ).toHaveAttribute('aria-current', 'page');
});

test('renders the message form with required fields', () => {
  render(<ContactPage />);
  ['First Name', 'Last Name', 'Email', 'Subject', 'Message'].forEach((label) => {
    expect(screen.getByLabelText(label)).toBeRequired();
  });
  expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  expect(
    screen.getByRole('button', { name: /send message/i })
  ).toBeInTheDocument();
});

test('submitting does not claim the message was sent and keeps the input', () => {
  render(<ContactPage />);
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'Hello' },
  });
  fireEvent.submit(screen.getByRole('button', { name: /send message/i }));

  expect(screen.getByRole('status')).toHaveTextContent(/not connected yet/i);
  expect(screen.getByLabelText('Message')).toHaveValue('Hello');
});
