import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getHomeHref } from './homeRoutes';
import { LoadingState } from '../components/StatusMessage';
import { LOGIN_HREF } from '../config/navigation';

/**
 * Route guard. The backend enforces every permission; this only keeps people
 * out of screens they cannot use and sends signed-out visitors to login.
 *
 * allow(user) → boolean decides access for signed-in users.
 */
function RequireAuth({ allow = () => true, children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingState label="Checking your session…" fullPage />;
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${LOGIN_HREF}?next=${next}`} replace />;
  }

  if (!allow(user)) {
    return <Navigate to={getHomeHref(user)} replace />;
  }

  return children;
}

export const isPatient = (user) => user.role === 'patient';
export const isSystemAdmin = (user) => user.role === 'system_admin';
export const hasClinicAccess = (user) => (user.memberships ?? []).length > 0;
export const isClinicApplicant = (user) => user.role === 'clinic_admin';

export default RequireAuth;
