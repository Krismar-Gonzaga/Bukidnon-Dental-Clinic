import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, CURRENT_USER_KEY } from './auth/AuthContext';
import { ROUTER_FUTURE } from './config/router';

export const PATIENT_USER = { id: 1, name: 'Juan Dela Cruz', email: 'juan@example.com', role: 'patient', memberships: [] };

export const clinicUser = (permissions, role = 'clinic_admin', overrides = {}) => ({
  id: 2,
  name: 'Ana Reyes',
  email: 'ana@example.com',
  role,
  memberships: [{ clinic_id: 7, clinic_name: 'Valencia Smiles', role, permissions }],
  ...overrides,
});

/**
 * Renders `ui` inside the app providers.
 * - route: the starting URL; path: the route pattern (for useParams).
 * - user: the signed-in user (null = signed out). Seeded into the auth
 *   cache, so no /user request is made.
 */
export function renderWithProviders(ui, { route = '/', path = '*', user = null } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  queryClient.setQueryData(CURRENT_USER_KEY, user);

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]} future={ROUTER_FUTURE}>
        <AuthProvider>
          <Routes>
            <Route path={path} element={ui} />
            <Route path="*" element={<p>Navigated away</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { ...result, queryClient };
}

/** An axios-style error for mocked API calls. */
export const apiError = (status, data = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
