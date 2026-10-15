import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser, logout as logoutRequest } from '../services/authService';
import { onSessionExpired } from '../services/apiClient';

export const CURRENT_USER_KEY = ['auth', 'currentUser'];

const AuthContext = createContext(null);

/**
 * Who is signed in, from GET /api/user (the session cookie is HttpOnly, so
 * the server is the only source of truth). Pages read it with useAuth().
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { data: user, isPending, refetch } = useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // A 401 on any signed-in request means the session expired: forget the
  // user so protected routes send them to the login page.
  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.setQueryData(CURRENT_USER_KEY, null);
      }),
    [queryClient]
  );

  const setUser = useCallback(
    (nextUser) => queryClient.setQueryData(CURRENT_USER_KEY, nextUser),
    [queryClient]
  );

  const signOut = useCallback(async () => {
    await logoutRequest();
    // Drop every cached response so the next person sees nothing of this one.
    queryClient.clear();
    queryClient.setQueryData(CURRENT_USER_KEY, null);
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user: user ?? null,
      isLoading: isPending,
      isAuthenticated: Boolean(user),
      memberships: user?.memberships ?? [],
      setUser,
      signOut,
      refresh: refetch,
    }),
    [user, isPending, setUser, signOut, refetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
