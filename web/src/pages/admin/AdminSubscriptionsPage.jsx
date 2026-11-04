import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { TableFooter } from '../../components/admin/AdminData';
import { ActionDialog, StatusTag, formatMonthly } from '../../components/admin/AdminUi';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_SUBSCRIPTIONS_HREF, NO_PAYMENT_STATUS, PAYMENT_STATUS, SUBSCRIPTION_STATUS, getAdminSubscriptionHref } from '../../config/adminNavigation';
import { getAdminSubscriptions, verifySubscriptionPayment } from '../../services/adminApi';
import { formatShortDate } from '../../utils/dateTime';

const PER_PAGE = 25;

function SubscriptionsTable({ query, onPageChange }) {
  const queryClient = useQueryClient();
  const runSensitive = useSensitiveAction();
  const [approving, setApproving] = useState(null);
  const approve = useMutation({
    mutationFn: () => runSensitive(() => verifySubscriptionPayment(approving.payment_id)),
    onSuccess: () => {
      setApproving(null);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  return (
    <>
      <QueryState query={query} loadingLabel="Loading subscriptions…">
        {({ items, meta }) => (
          <section className="admin-table-panel" aria-label="Clinic subscriptions">
            <div className="admin-table-scroll">
              <table className="admin-grid">
                <caption className="visually-hidden">Clinic subscriptions</caption>
                <thead>
                  <tr>
                    <th scope="col">Clinic</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Due Date</th>
                    <th scope="col">Sub Status</th>
                    <th scope="col">Payment Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="admin-grid-empty">
                        No clinic subscriptions yet.
                      </td>
                    </tr>
                  )}
                  {items.map((row) => {
                    const status = SUBSCRIPTION_STATUS[row.status] ?? SUBSCRIPTION_STATUS.none;
                    const payment = PAYMENT_STATUS[row.payment_status] ?? NO_PAYMENT_STATUS;
                    return (
                      <tr key={row.clinic_id}>
                        <td className="admin-grid-strong">{row.clinic_name}</td>
                        <td>{row.plan}</td>
                        <td className="admin-grid-medium">{formatMonthly(row.amount)}</td>
                        <td>{row.due_at ? formatShortDate(row.due_at) : '—'}</td>
                        <td>
                          <StatusTag tone={status.tone}>{status.label}</StatusTag>
                        </td>
                        <td>
                          <StatusTag tone={payment.tone}>{payment.label}</StatusTag>
                        </td>
                        <td>
                          <div className="admin-grid-actions">
                            {row.payment_status === 'pending' && (
                              <button
                                type="button"
                                className="admin-soft-button is-success"
                                aria-label={`Approve payment from ${row.clinic_name}`}
                                onClick={() => {
                                  approve.reset();
                                  setApproving(row);
                                }}
                              >
                                Approve
                              </button>
                            )}
                            <a href={getAdminSubscriptionHref(row.clinic_id)} className="admin-row-chevron" aria-label={`Open subscription of ${row.clinic_name}`}>
                              <Icon name="chevronRight" size={18} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(meta.last_page ?? 1) > 1 && <TableFooter meta={meta} perPage={PER_PAGE} onPageChange={onPageChange} noun="subscriptions" label="Subscription pages" />}
          </section>
        )}
      </QueryState>

      {approving && (
        <ActionDialog
          title="Approve Payment"
          message={
            <>
              Are you sure you want to <strong>approve</strong> the payment from {approving.clinic_name}? This renews their subscription. Only approve after checking the
              money reached the account.
            </>
          }
          isBusy={approve.isPending}
          error={approve.error}
          onConfirm={() => approve.mutate()}
          onCancel={() => setApproving(null)}
        />
      )}
    </>
  );
}

function AdminSubscriptionsPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin', 'subscriptions', page],
    queryFn: () => getAdminSubscriptions({ page, per_page: PER_PAGE }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.meta.total;

  return (
    <AdminLayout
      title="Subscription Management"
      subtitle={total == null ? undefined : `${total} clinic ${total === 1 ? 'subscription' : 'subscriptions'}`}
      activeHref={ADMIN_SUBSCRIPTIONS_HREF}
    >
      <SubscriptionsTable query={query} onPageChange={setPage} />
    </AdminLayout>
  );
}

export default AdminSubscriptionsPage;
