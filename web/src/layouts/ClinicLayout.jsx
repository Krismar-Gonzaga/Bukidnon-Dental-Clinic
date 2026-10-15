import { createContext, useContext } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PortalLayout from './PortalLayout';
import { useAuth } from '../auth/AuthContext';
import {
  canAny,
  CLINIC_PORTAL_HREF,
  CLINIC_ROLE_LABELS,
  CLINIC_SECTIONS,
  getClinicHref,
} from '../config/clinicNavigation';
import '../components/portal/portal.css';

const ClinicContext = createContext(null);

/** Current clinic, the member's role there, and a permission check. */
export function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) throw new Error('useClinic must be used inside <ClinicLayout>.');
  return context;
}

function ClinicSwitcher({ memberships, clinicId }) {
  const navigate = useNavigate();
  if (memberships.length < 2) return null;

  return (
    <label className="portal-field portal-clinic-switcher">
      <span className="portal-field-label">Clinic</span>
      <select
        className="portal-field-control"
        value={clinicId}
        onChange={(event) => navigate(getClinicHref(event.target.value))}
      >
        {memberships.map((m) => (
          <option key={m.clinic_id} value={String(m.clinic_id)}>
            {m.clinic_name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Frame for /clinic/:clinicId/* pages. Navigation shows only the sections the
 * member's permissions allow; the API enforces the same permissions.
 * `requires` (list of permissions, any of) guards the page itself.
 */
function ClinicLayout({ section, title, requires, children }) {
  const { clinicId } = useParams();
  const { memberships } = useAuth();
  const membership = memberships.find((m) => String(m.clinic_id) === String(clinicId));

  if (!membership) return <Navigate to={CLINIC_PORTAL_HREF} replace />;

  const permissions = membership.permissions ?? [];
  const can = (...anyOf) => canAny(permissions, anyOf);

  if (requires && !can(...requires)) return <Navigate to={getClinicHref(clinicId)} replace />;

  const navItems = CLINIC_SECTIONS.filter(({ anyOf }) => canAny(permissions, anyOf)).map((item) => ({
    label: item.label,
    href: getClinicHref(clinicId, item.section),
    icon: item.icon,
  }));

  return (
    <ClinicContext.Provider value={{ clinicId, membership, clinicName: membership.clinic_name, can }}>
      <PortalLayout
        title={title}
        navItems={navItems}
        activeHref={getClinicHref(clinicId, section)}
        roleLabel={`${CLINIC_ROLE_LABELS[membership.role] ?? membership.role} · ${membership.clinic_name}`}
        notificationsHref={getClinicHref(clinicId, 'notifications')}
        navLabel="Clinic"
        sidebarExtra={<ClinicSwitcher memberships={memberships} clinicId={clinicId} />}
      >
        {children}
      </PortalLayout>
    </ClinicContext.Provider>
  );
}

export default ClinicLayout;
