import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { BackLink, Card } from '../../components/clinic/ClinicAdminUi';
import { ActionDialog, DetailTile, StatusTag, formatMonthYear } from '../../components/admin/AdminUi';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_CLINICS_HREF, CLINIC_STATUS, SUBSCRIPTION_STATUS, getAdminApplicationHref } from '../../config/adminNavigation';
import { getAdminClinic, reactivateClinic, suspendClinic } from '../../services/adminApi';
import { formatShortDate } from '../../utils/dateTime';

function ClinicActions({ clinic, onChanged }) {
  const runSensitive = useSensitiveAction();
  const [asking, setAsking] = useState(false);
  const isSuspended = clinic.status === 'suspended';
  const change = useMutation({
    mutationFn: (reason) => runSensitive(() => (isSuspended ? reactivateClinic(clinic.id) : suspendClinic(clinic.id, reason))),
    onSuccess: () => {
      setAsking(false);
      onChanged();
    },
  });

  return (
    <Card title="Actions">
      <div className="admin-action-stack">
        <button
          type="button"
          className={`admin-action-button ${isSuspended ? 'is-success' : 'is-warning'}`}
          onClick={() => {
            change.reset();
            setAsking(true);
          }}
        >
          <Icon name={isSuspended ? 'checkCircle' : 'alertCircle'} size={18} />
          {isSuspended ? 'Reactivate Clinic' : 'Suspend Clinic'}
        </button>
        {clinic.application_id && (
          <a href={getAdminApplicationHref(clinic.application_id)} className="admin-action-button">
            <Icon name="shield" size={18} />
            View Verification
          </a>
        )}
      </div>

      {asking && (
        <ActionDialog
          title={isSuspended ? 'Reactivate Clinic' : 'Suspend Clinic'}
          message={
            <>
              Are you sure you want to <strong>{isSuspended ? 'reactivate' : 'suspend'}</strong> this clinic?
            </>
          }
          confirmLabel={isSuspended ? 'Confirm Reactivate' : 'Confirm Suspend'}
          reasonLabel={isSuspended ? undefined : 'Reason (recorded in the audit log)'}
          isBusy={change.isPending}
          error={change.error}
          onConfirm={(reason) => change.mutate(reason)}
          onCancel={() => setAsking(false)}
        />
      )}
    </Card>
  );
}

function AdminClinicDetailPage() {
  const { clinicId } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'clinic', clinicId], queryFn: () => getAdminClinic(clinicId) });

  return (
    <AdminLayout title="Clinic Details" activeHref={ADMIN_CLINICS_HREF}>
      <BackLink href={ADMIN_CLINICS_HREF}>Back to Clinics</BackLink>
      <QueryState query={query} loadingLabel="Loading clinic…">
        {(clinic) => {
          const status = CLINIC_STATUS[clinic.status] ?? CLINIC_STATUS.pending;
          const subscription = SUBSCRIPTION_STATUS[clinic.subscription_status] ?? SUBSCRIPTION_STATUS.none;
          return (
            <div className="admin-detail-columns">
              <div className="admin-stack">
                <Card className="admin-detail-card">
                  <div className="admin-detail-head">
                    <div>
                      <h2 className="admin-detail-name">{clinic.name}</h2>
                      <p className="admin-detail-sub">{[clinic.city, clinic.admin && `Admin: ${clinic.admin}`].filter(Boolean).join(' · ')}</p>
                    </div>
                    <StatusTag tone={status.tone}>{status.label}</StatusTag>
                  </div>
                  <div className="admin-detail-tiles">
                    <DetailTile label="Plan" value={clinic.plan} />
                    <DetailTile label="Since" value={formatMonthYear(clinic.since)} />
                    <DetailTile label="Renewal" value={formatMonthYear(clinic.renews_at)} />
                    <DetailTile label="Sub Status" value={subscription.label} />
                  </div>
                  {clinic.suspension_reason && (
                    <p className="clinic-warning-note admin-spaced-top">
                      <Icon name="alertTriangle" size={16} />
                      Suspended: {clinic.suspension_reason}
                    </p>
                  )}
                </Card>
                <Card title="Clinic Activity">
                  {clinic.activity.length === 0 ? (
                    <p className="admin-muted">No activity recorded yet.</p>
                  ) : (
                    <ul className="admin-activity">
                      {clinic.activity.map((item) => (
                        <li key={item.id}>
                          <span className="admin-feed-dot is-primary" aria-hidden="true" />
                          {item.label} — {formatShortDate(item.at)}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
              <div className="admin-stack">
                <ClinicActions clinic={clinic} onChanged={() => queryClient.invalidateQueries({ queryKey: ['admin'] })} />
              </div>
            </div>
          );
        }}
      </QueryState>
    </AdminLayout>
  );
}

export default AdminClinicDetailPage;
