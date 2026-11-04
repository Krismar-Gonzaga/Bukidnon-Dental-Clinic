import { useEffect, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AuthProvider, CURRENT_USER_KEY, useAuth } from './AuthContext';
import { fetchCurrentUser, logout } from '../services/authService';

jest.mock('../services/authService');

const USER = { id: 1, name: 'Dana Reyes', role: 'clinic_admin', memberships: [] };

function Probe() {
  const { user, signOut } = useAuth();
  const [error, setError] = useState('');
  return (
    <>
      <p>{user ? `signed in as ${user.name}` : 'signed out'}</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={() => signOut().catch((e) => setError(e.message))}>
        Log out
      </button>
    </>
  );
}

const renderProbe = (extra = null) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  queryClient.setQueryData(CURRENT_USER_KEY, USER);
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
        {extra}
      </AuthProvider>
    </QueryClientProvider>
  );
  return queryClient;
};

beforeEach(() => {
  fetchCurrentUser.mockResolvedValue(USER);
  logout.mockResolvedValue(undefined);
});

test('the screen shows signed out as soon as logout finishes, without a reload', async () => {
  renderProbe();
  expect(screen.getByText('signed in as Dana Reyes')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

  expect(await screen.findByText('signed out')).toBeInTheDocument();
  expect(screen.queryByText(/signed in as/)).not.toBeInTheDocument();
});

test('logout removes what the previous person loaded', async () => {
  const queryClient = renderProbe();
  queryClient.setQueryData(['clinic', 7, 'patients'], [{ name: 'Private Patient' }]);

  fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

  await screen.findByText('signed out');
  expect(queryClient.getQueryData(['clinic', 7, 'patients'])).toBeUndefined();
});

test('a session check still running when logout finishes cannot sign the person back in', async () => {
  let finishCheck;
  fetchCurrentUser.mockImplementation(() => new Promise((resolve) => (finishCheck = resolve)));

  function RefetchOnMount() {
    const { refresh } = useAuth();
    useEffect(() => {
      refresh();
    }, [refresh]);
    return null;
  }

  renderProbe(<RefetchOnMount />);
  await waitFor(() => expect(finishCheck).toBeDefined());

  fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
  await screen.findByText('signed out');

  finishCheck(USER);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.getByText('signed out')).toBeInTheDocument();
});

test('when the server could not log out, the person stays signed in and is told', async () => {
  logout.mockRejectedValue(new Error('Could not reach the server'));
  const queryClient = renderProbe();
  queryClient.setQueryData(['clinic', 7, 'patients'], [{ name: 'Still needed' }]);

  fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
  expect(screen.getByText('signed in as Dana Reyes')).toBeInTheDocument();
  expect(queryClient.getQueryData(['clinic', 7, 'patients'])).toHaveLength(1);
});
