import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import AuthPageLayout from '../../layouts/AuthPageLayout';
import { Badge, FormError } from '../../components/portal/PortalUi';
import { useAuth } from '../../auth/AuthContext';
import { CLINIC_APPLY_HREF, CLINIC_ROLE_LABELS, getClinicHref } from '../../config/clinicNavigation';
import { getMyInvitations, respondToInvitation } from '../../services/clinicPortalApi';
import '../../components/auth/auth.css';
import '../../components/portal/portal.css';

/**
 * /clinic: picks the clinic to work in. One active membership goes straight
 * to its dashboard; pending invitations can be accepted here.
 */
function ClinicHomePage() {
  const { user, memberships, refresh } = useAuth();
  const queryClient = useQueryClient();
  const invitations = useQuery({ queryKey: ['my', 'invitations'], queryFn: getMyInvitations });
  const respond = useMutation({
    mutationFn: ({ id, accept }) => respondToInvitation(id, accept),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my', 'invitations'] });
      await refresh();
    },
  });

  const pending = invitations.data ?? [];
  if (memberships.length === 1 && pending.length === 0 && !invitations.isPending) {
    return <Navigate to={getClinicHref(memberships[0].clinic_id)} replace />;
  }

  return (
    <AuthPageLayout>
      <div className="auth-card">
        <h1 className="auth-title">Your clinics</h1>
        <p className="auth-subtitle">Signed in as {user?.name}</p>

        {memberships.length > 0 ? (
          <ul className="portal-list">
            {memberships.map((m) => (
              <li key={m.clinic_id}>
                <a href={getClinicHref(m.clinic_id)} className="portal-list-item portal-list-link">
                  <strong>{m.clinic_name}</strong>
                  <p className="portal-list-item-meta">{CLINIC_ROLE_LABELS[m.role] ?? m.role}</p>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="auth-notice">You are not a member of any clinic yet.</p>
        )}

        {pending.length > 0 && (
          <>
            <h2 className="portal-section-title portal-spaced-top">
              Invitations
            </h2>
            <ul className="portal-list">
              {pending.map((invite) => (
                <li key={invite.id} className="portal-list-item">
                  <strong>{invite.clinic.name}</strong> <Badge status="invited">invited</Badge>
                  <p className="portal-list-item-meta">{CLINIC_ROLE_LABELS[invite.role] ?? invite.role}</p>
                  <div className="portal-actions portal-spaced-top-sm">
                    <button type="button" className="btn btn-primary btn-sm" disabled={respond.isPending}
                      onClick={() => respond.mutate({ id: invite.id, accept: true })}>
                      Accept
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={respond.isPending}
                      onClick={() => respond.mutate({ id: invite.id, accept: false })}>
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <FormError error={respond.error} />
          </>
        )}

        {user?.role === 'clinic_admin' && (
          <p className="auth-footer">
            Registering a new clinic? <a href={CLINIC_APPLY_HREF}>Clinic application</a>
          </p>
        )}
      </div>
    </AuthPageLayout>
  );
}

export default ClinicHomePage;
