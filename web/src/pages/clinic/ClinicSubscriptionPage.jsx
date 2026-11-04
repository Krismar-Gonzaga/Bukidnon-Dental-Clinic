import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { Card } from '../../components/clinic/ClinicAdminUi';
import { Pill } from '../../components/clinic/ClinicUi';
import { ConfirmDialog, FormError } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref } from '../../config/clinicNavigation';
import { downloadInvoice, getSubscription, requestRenewal } from '../../services/clinicPortalApi';
import { formatDate, formatShortDate } from '../../utils/dateTime';
import '../../components/clinic/ClinicAdminUi.css';

const PLAN_STATUS = {
  active: { label: 'Active', tone: 'success' },
  expired: { label: 'Expired', tone: 'danger' },
  none: { label: 'Not started', tone: 'neutral' },
};

const PAYMENT_STATUS = {
  pending: { label: 'Pending', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export const formatPeso = (amount) => `₱${Number(amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

function PlanCard({ data, clinicName, proofHref }) {
  const queryClient = useQueryClient();
  const { clinicId } = useClinicAccess();
  const [asking, setAsking] = useState(false);
  const renewal = useMutation({
    mutationFn: () => requestRenewal(clinicId),
    onSuccess: () => {
      setAsking(false);
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'subscription'] });
    },
  });
  const status = PLAN_STATUS[data.status] ?? PLAN_STATUS.none;

  return (
    <Card>
      <div className="clinic-plan-head">
        <div>
          <p className="clinic-plan-name">
            {data.plan.name} <Pill tone={status.tone}>{status.label}</Pill>
          </p>
          <p className="clinic-admin-card-sub">
            {clinicName} · {data.plan.billing}
          </p>
        </div>
        <div>
          <p className="clinic-plan-price">{formatPeso(data.plan.price)}</p>
          <p className="clinic-plan-period">per month</p>
        </div>
      </div>
      <dl className="clinic-plan-tiles">
        <div className="clinic-plan-tile">
          <dt>Subscription Status</dt>
          <dd>{status.label}</dd>
        </div>
        <div className="clinic-plan-tile">
          <dt>Next Renewal Date</dt>
          <dd>{data.renews_at ? formatDate(data.renews_at) : '—'}</dd>
        </div>
        <div className="clinic-plan-tile">
          <dt>Days Remaining</dt>
          <dd>{data.days_remaining != null ? `${data.days_remaining} days` : '—'}</dd>
        </div>
      </dl>
      <p className="clinic-section-label">Plan Features</p>
      <ul className="clinic-plan-features">
        {data.plan.features.map((feature) => (
          <li key={feature}>
            <Icon name="checkCircle" size={16} />
            {feature}
          </li>
        ))}
      </ul>
      {data.has_pending_payment && (
        <p className="clinic-info-note">
          <Icon name="info" size={16} />A payment proof is waiting for review. You can send another once it has been reviewed.
        </p>
      )}
      {renewal.isSuccess && (
        <p className="clinic-saved-note" role="status">
          <Icon name="checkCircle" size={16} />
          Your renewal request was sent to the system administrators.
        </p>
      )}
      <div className="clinic-header-actions clinic-form-gap">
        {!data.has_pending_payment && (
          <a href={proofHref} className="btn btn-primary clinic-header-button">
            <Icon name="upload" size={18} />
            Upload Payment Proof
          </a>
        )}
        <button
          type="button"
          className="btn btn-outline clinic-header-button"
          onClick={() => {
            renewal.reset();
            setAsking(true);
          }}
        >
          <Icon name="refresh" size={18} />
          Request Renewal
        </button>
      </div>
      {asking && (
        <ConfirmDialog
          title="Request renewal?"
          message="The system administrators will be told you want to renew this plan."
          confirmLabel="Request Renewal"
          isBusy={renewal.isPending}
          error={renewal.error}
          onConfirm={() => renewal.mutate()}
          onCancel={() => setAsking(false)}
        />
      )}
    </Card>
  );
}

function BillingHistory({ payments }) {
  const { clinicId } = useClinicAccess();
  const invoice = useMutation({ mutationFn: (payment) => downloadInvoice(clinicId, payment) });
  return (
    <Card title="Billing History">
      <FormError error={invoice.error} />
      <div className="clinic-data-scroll">
        <table className="clinic-data-table">
          <caption className="visually-hidden">Billing history</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Description</th>
              <th scope="col">Amount</th>
              <th scope="col">Invoice</th>
              <th scope="col">Status</th>
              <th scope="col" className="is-end">
                <span className="visually-hidden">Download</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const status = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS.pending;
              return (
                <tr key={payment.id}>
                  <td data-label="Date">{formatShortDate(payment.date)}</td>
                  <td data-label="Description">
                    {payment.description}
                    {payment.status === 'rejected' && payment.review_note && <span className="clinic-cell-sub">{payment.review_note}</span>}
                  </td>
                  <td data-label="Amount">
                    <strong>{formatPeso(payment.amount)}</strong>
                  </td>
                  <td data-label="Invoice">{payment.invoice_number ?? '—'}</td>
                  <td data-label="Status">
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </td>
                  <td data-label="" className="is-end">
                    {payment.status === 'verified' && (
                      <button type="button" className="clinic-link-button" disabled={invoice.isPending} aria-label={`Download invoice ${payment.invoice_number}`} onClick={() => invoice.mutate(payment)}>
                        <Icon name="fileText" size={16} />
                        PDF
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="clinic-empty-row">
                  No payments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ClinicSubscriptionPage() {
  const { clinicId, membership, can } = useClinicAccess();
  const query = useQuery({ queryKey: ['clinic', clinicId, 'subscription'], queryFn: () => getSubscription(clinicId), enabled: can('subscription.manage') });

  return (
    <ClinicLayout section="subscription" title="Subscription Management" subtitle={null} requires={['subscription.manage']} hideSearch>
      <div className="clinic-narrow-page">
        <QueryState query={query} loadingLabel="Loading subscription…">
          {(data) => (
            <>
              <PlanCard data={data} clinicName={membership?.clinic_name} proofHref={`${getClinicHref(clinicId, 'subscription')}/payment`} />
              <BillingHistory payments={data.payments} />
            </>
          )}
        </QueryState>
      </div>
    </ClinicLayout>
  );
}

export default ClinicSubscriptionPage;
