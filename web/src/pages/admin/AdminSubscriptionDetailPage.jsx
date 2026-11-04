import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { BackLink, Card } from '../../components/clinic/ClinicAdminUi';
import { ActionDialog, DetailTile, StatusTag, WorkflowSteps, formatMoney, formatMonthly } from '../../components/admin/AdminUi';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import { Field, FormError } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_SUBSCRIPTIONS_HREF, NO_PAYMENT_STATUS, PAYMENT_STATUS, SUBSCRIPTION_STATUS } from '../../config/adminNavigation';
import { changeSubscriptionPlan, downloadPaymentProof, getAdminSubscription, rejectSubscriptionPayment, verifySubscriptionPayment } from '../../services/adminApi';
import { formatShortDate } from '../../utils/dateTime';

function ProofCard({ subscription }) {
  const { payment } = subscription;
  const download = useMutation({ mutationFn: () => downloadPaymentProof(payment.id, `payment-proof-${subscription.clinic_id}-${payment.id}`) });

  return (
    <div className="admin-proof">
      <h3 className="admin-proof-title">{payment.status === 'pending' ? 'Proof of Payment Submitted' : 'Latest Proof of Payment'}</h3>
      <div className="admin-proof-row">
        <Icon name="fileText" size={28} />
        <div className="admin-proof-text">
          <p className="admin-proof-name">{[payment.method, payment.reference && `Ref. ${payment.reference}`].filter(Boolean).join(' · ')}</p>
          <p className="admin-proof-meta">
            Submitted by {payment.submitted_by ?? 'Clinic Admin'} · {formatShortDate(payment.submitted_at)}
          </p>
        </div>
        <button type="button" className="admin-proof-download" disabled={download.isPending} onClick={() => download.mutate()}>
          <Icon name="download" size={16} />
          {download.isPending ? 'Downloading…' : 'Download'}
        </button>
      </div>
      <FormError error={download.error} />
    </div>
  );
}

function PaymentActions({ subscription, onChanged }) {
  const runSensitive = useSensitiveAction();
  const [kind, setKind] = useState(null);
  const { payment } = subscription;
  const isApprove = kind === 'approve';
  const decide = useMutation({
    mutationFn: (note) => runSensitive(() => (isApprove ? verifySubscriptionPayment(payment.id) : rejectSubscriptionPayment(payment.id, note))),
    onSuccess: () => {
      setKind(null);
      onChanged();
    },
  });
  const ask = (next) => {
    decide.reset();
    setKind(next);
  };

  return (
    <Card title="Payment Actions">
      {payment?.status === 'pending' ? (
        <div className="admin-action-stack">
          <button type="button" className="admin-action-button is-solid-success" onClick={() => ask('approve')}>
            <Icon name="check" size={18} />
            Approve Payment
          </button>
          <button type="button" className="admin-action-button is-danger" onClick={() => ask('reject')}>
            <Icon name="close" size={18} />
            Reject Payment
          </button>
        </div>
      ) : payment?.status === 'verified' ? (
        <p className="admin-result-note is-success" role="status">
          <Icon name="checkCircle" size={18} />
          Payment verified.{subscription.status === 'active' ? ' Subscription active.' : ''}
        </p>
      ) : payment?.status === 'rejected' ? (
        <>
          <p className="admin-result-note is-danger" role="status">
            <Icon name="alertCircle" size={18} />
            Payment rejected. Waiting for a new proof.
          </p>
          {payment.review_note && <p className="admin-muted admin-spaced-top">{payment.review_note}</p>}
        </>
      ) : (
        <p className="admin-muted">No payment proof submitted yet.</p>
      )}

      {kind && (
        <ActionDialog
          title={isApprove ? 'Approve Payment' : 'Reject Payment'}
          message={
            <>
              Are you sure you want to <strong>{isApprove ? 'approve' : 'reject'}</strong> this payment?
              {isApprove ? ' This renews the subscription and issues an invoice. Only approve after checking the money reached the account.' : ''}
            </>
          }
          reasonLabel={isApprove ? undefined : 'Reason (shared with the clinic)'}
          isBusy={decide.isPending}
          error={decide.error}
          onConfirm={(note) => decide.mutate(note)}
          onCancel={() => setKind(null)}
        />
      )}
    </Card>
  );
}

function ChangePlan({ subscription, onChanged }) {
  const runSensitive = useSensitiveAction();
  const [plan, setPlan] = useState(subscription.plan_key);
  const save = useMutation({ mutationFn: () => runSensitive(() => changeSubscriptionPlan(subscription.clinic_id, plan)), onSuccess: onChanged });

  return (
    <Card title="Change Plan">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Field
          label="Plan"
          as="select"
          hint="Applies from the clinic's next payment. The due date does not move."
          options={subscription.plans.map((option) => ({ value: option.key, label: `${option.name} (${formatMonthly(option.price)})` }))}
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
        />
        <FormError error={save.error} />
        <button type="submit" className="btn btn-outline btn-sm admin-spaced-top" disabled={plan === subscription.plan_key || save.isPending}>
          {save.isPending ? 'Saving…' : 'Change Plan'}
        </button>
      </form>
    </Card>
  );
}

function PaymentHistory({ history }) {
  if (history.length < 2) return null;

  return (
    <Card title="Payment History">
      <ul className="admin-breakdown">
        {history.map((payment) => {
          const status = PAYMENT_STATUS[payment.status] ?? NO_PAYMENT_STATUS;
          return (
            <li key={payment.id}>
              <span>
                {formatShortDate(payment.submitted_at)} · {formatMoney(payment.amount)} · {payment.method}
                {payment.invoice_number ? ` · ${payment.invoice_number}` : ''}
              </span>
              <StatusTag tone={status.tone}>{status.label}</StatusTag>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AdminSubscriptionDetailPage() {
  const { clinicId } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'subscription', clinicId], queryFn: () => getAdminSubscription(clinicId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  return (
    <AdminLayout title="Subscription & Payment Review" activeHref={ADMIN_SUBSCRIPTIONS_HREF}>
      <BackLink href={ADMIN_SUBSCRIPTIONS_HREF}>Back to Subscriptions</BackLink>
      <QueryState query={query} loadingLabel="Loading subscription…">
        {(subscription) => {
          const status = SUBSCRIPTION_STATUS[subscription.status] ?? SUBSCRIPTION_STATUS.none;
          const paymentStatus = PAYMENT_STATUS[subscription.payment_status] ?? NO_PAYMENT_STATUS;
          const due = subscription.due_at ? formatShortDate(subscription.due_at) : '—';
          const { payment } = subscription;
          return (
            <div className="admin-detail-columns">
              <div className="admin-stack">
                <Card className="admin-detail-card">
                  <h2 className="admin-detail-name">{subscription.clinic_name}</h2>
                  <p className="admin-detail-sub">
                    Plan: {subscription.plan} · Amount: {formatMonthly(subscription.amount)} · Due: {due}
                  </p>
                  <div className="admin-detail-tiles">
                    <DetailTile label="Subscription Status" value={status.label} />
                    <DetailTile label="Payment Status" value={paymentStatus.label} />
                    <DetailTile label="Due Date" value={due} />
                    <DetailTile label="Plan" value={subscription.plan} />
                  </div>
                  {payment && <ProofCard subscription={subscription} />}
                </Card>
                <PaymentHistory history={subscription.history} />
              </div>
              <div className="admin-stack">
                <PaymentActions subscription={subscription} onChanged={refresh} />
                <Card title="Payment Workflow">
                  <WorkflowSteps
                    label="Payment progress"
                    steps={[
                      { label: 'Plan billed to clinic', done: true },
                      { label: 'Clinic pays externally', done: Boolean(payment) },
                      { label: 'Proof of payment submitted', done: Boolean(payment) },
                      { label: 'System Admin reviews proof', done: payment ? payment.status !== 'pending' : false },
                      { label: 'Subscription activated / renewed', done: payment?.status === 'verified' && subscription.status === 'active' },
                    ]}
                  />
                </Card>
                <ChangePlan key={subscription.plan_key} subscription={subscription} onChanged={refresh} />
              </div>
            </div>
          );
        }}
      </QueryState>
    </AdminLayout>
  );
}

export default AdminSubscriptionDetailPage;
