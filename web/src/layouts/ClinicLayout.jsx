import { createContext, useContext } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import ClinicShell from './ClinicShell';
import Icon from '../components/Icon';
import WalkInAction from '../components/portal/WalkInAction';
import { useAuth } from '../auth/AuthContext';
import {
  canAny,
  CLINIC_PORTAL_HREF,
  CLINIC_ROLE_LABELS,
  getClinicHref,
  getClinicSections,
  isDentistMember,
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
 * The clinic from the URL and the member's permissions, for page components
 * that render ClinicLayout themselves (their header buttons and subtitle sit
 * outside its provider). `useClinic` is for everything inside the layout.
 */
export function useClinicAccess() {
  const { clinicId } = useParams();
  const { memberships } = useAuth();
  const membership = memberships.find((m) => String(m.clinic_id) === String(clinicId));
  const permissions = membership?.permissions ?? [];
  return { clinicId, membership, can: (...anyOf) => canAny(permissions, anyOf) };
}

/**
 * Frame for /clinic/:clinicId/* pages. Navigation shows only the sections the
 * member's permissions allow; the API enforces the same permissions.
 * `requires` (list of permissions, any of) guards the page itself.
 * `subtitle`, `search`, `hideSearch`, `showWalkIn` and `headerActions`
 * customise the top bar (see ClinicShell).
 */
function ClinicLayout({ section, title, subtitle, requires, search, hideSearch = false, showWalkIn = false, headerActions, children }) {
  const { clinicId } = useParams();
  const { memberships } = useAuth();
  const membership = memberships.find((m) => String(m.clinic_id) === String(clinicId));

  if (!membership) return <Navigate to={CLINIC_PORTAL_HREF} replace />;

  const permissions = membership.permissions ?? [];
  const can = (...anyOf) => canAny(permissions, anyOf);

  if (requires && !can(...requires)) return <Navigate to={getClinicHref(clinicId)} replace />;

  const sections = getClinicSections(membership).filter(({ anyOf }) => canAny(permissions, anyOf));
  const navItems = sections.map((item) => ({
    label: item.label,
    href: getClinicHref(clinicId, item.section),
    icon: item.icon,
    group: item.group,
  }));
  // Pages without their own sidebar entry (e.g. appointments for dentists) highlight their alias.
  const activeSection = sections.find((item) => item.aliases?.includes(section))?.section ?? section;
  const isDentist = isDentistMember(membership);

  return (
    <ClinicContext.Provider value={{ clinicId, membership, clinicName: membership.clinic_name, can }}>
      <ClinicShell
        clinicId={clinicId}
        clinicName={membership.clinic_name}
        title={title}
        subtitle={subtitle}
        navItems={navItems}
        activeHref={getClinicHref(clinicId, activeSection)}
        scheduleHref={getClinicHref(clinicId, isDentist ? 'schedule' : 'appointments')}
        showSignOut={isDentist}
        grouped={!isDentist}
        roleLabel={`${CLINIC_ROLE_LABELS[membership.role] ?? membership.role} · ${membership.clinic_name}`}
        shortRoleLabel={CLINIC_ROLE_LABELS[membership.role] ?? membership.role}
        can={can}
        search={search}
        hideSearch={hideSearch}
        headerActions={
          <>
            {headerActions}
            {showWalkIn && !isDentist && can('appointments.manage') && can('patients.view') && (
              <WalkInAction clinicId={clinicId} can={can} className="btn btn-primary btn-sm clinic-walkin-button">
                <Icon name="plus" size={18} />
                Walk-in
              </WalkInAction>
            )}
          </>
        }
        sidebarExtra={<ClinicSwitcher memberships={memberships} clinicId={clinicId} />}
      >
        {children}
      </ClinicShell>
    </ClinicContext.Provider>
  );
}

export default ClinicLayout;
