// Subscription & Payment Review (web: pages/admin/AdminSubscriptionDetailPage.jsx). Proofs open
// through a 5-minute signed link. Approving, rejecting and changing a plan need the password (423).
import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, Text, View } from 'react-native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { actionError, PasswordPrompt, useSensitiveAction } from '../../components/admin/AdminSecurity';
import { DetailTiles, WorkflowSteps } from '../../components/admin/AdminWidgets';
import { Badge, Button, Card, Field, FormError, InfoRow, LoadState, SelectField, Sheet, ui, useLoader } from '../../components/clinic/ClinicUi';
import { changePlan, fetchSubscription, formatMonthly, NO_PAYMENT, PAYMENT_STATUS, proofUrl, rejectPayment, SubscriptionDetail, SUBSCRIPTION_STATUS, verifyPayment } from '../../services/admin';
import { formatDateTime, serverMessage } from '../../services/clinicPortal';

function DecisionSheet({ subscription, kind, onClose, onDone }: { subscription: SubscriptionDetail; kind: 'approve' | 'reject'; onClose: () => void; onDone: () => void }) {
  const sensitive = useSensitiveAction();
  const isApprove = kind === 'approve';
  const paymentId = subscription.payment?.id as number;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await sensitive.run<unknown>(() => (isApprove ? verifyPayment(paymentId) : rejectPayment(paymentId, note.trim())));
      onDone();
    } catch (err) {
      setError(actionError(err, 'The payment could not be updated.'));
      setBusy(false);
    }
  };

  return (
    <Sheet title={isApprove ? 'Approve Payment' : 'Reject Payment'} onClose={busy ? () => undefined : onClose}>
      <Text style={ui.muted}>
        {isApprove ? 'This renews the subscription and issues an invoice. Only approve after checking the money reached the account.' : 'The clinic is told why and can send a new proof.'}
      </Text>
      {!isApprove && <Field label="Reason (shared with the clinic)" required multiline maxLength={500} value={note} onChangeText={setNote} />}
      <FormError message={error} />
      <PasswordPrompt sensitive={sensitive} inline />
      {!sensitive.asking && (
        <Button label={isApprove ? 'Approve Payment' : 'Reject Payment'} variant={isApprove ? 'primary' : 'danger'} style={ui.spacedTop} busy={busy} disabled={!isApprove && !note.trim()} onPress={submit} />
      )}
    </Sheet>
  );
}

function PlanCard({ subscription, onChanged }: { subscription: SubscriptionDetail; onChanged: () => void }) {
  const sensitive = useSensitiveAction();
  const [plan, setPlan] = useState(subscription.plan_key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await sensitive.run(() => changePlan(subscription.clinic_id, plan));
      onChanged();
    } catch (err) {
      setError(actionError(err, 'The plan could not be changed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Change Plan" subtitle="Applies from the clinic's next payment. The due date does not move.">
      <SelectField label="Plan" options={subscription.plans.map((option) => ({ id: option.key, label: `${option.name} (${formatMonthly(option.price)})` }))} value={plan} onChange={setPlan} />
      <FormError message={error} />
      <Button small variant="outline" label="Change Plan" style={ui.spacedTop} busy={busy} disabled={plan === subscription.plan_key} onPress={save} />
      <PasswordPrompt sensitive={sensitive} />
    </Card>
  );
}

const AdminSubscriptionDetailScreen = ({ route }: { route: { params: { clinicId: number } } }) => {
  const { clinicId } = route.params;
  const subscription = useLoader(() => fetchSubscription(clinicId), [clinicId], 'This subscription could not be loaded.');
  const [kind, setKind] = useState<'approve' | 'reject' | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = subscription.data;
  const payment = s?.payment;

  const openProof = async () => {
    if (!payment) return;
    setOpening(true);
    setError(null);
    try {
      await Linking.openURL(await proofUrl(payment.id));
    } catch (err) {
      setError(serverMessage(err, 'The proof could not be opened.'));
    } finally {
      setOpening(false);
    }
  };

  return (
    <AdminScreen title="Payment Review" active="AdminSubscriptionDetail" back>
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={subscription.refreshing} onRefresh={subscription.refresh} />}>
        {!s ? (
          <LoadState loading={subscription.loading} error={subscription.error} onRetry={subscription.reload} />
        ) : (
          <>
            <Card title={s.clinic_name} subtitle={`Plan: ${s.plan} · Amount: ${formatMonthly(s.amount)}`}>
              <DetailTiles
                tiles={[
                  { label: 'Subscription Status', value: SUBSCRIPTION_STATUS[s.status]?.label ?? s.status },
                  { label: 'Payment Status', value: ((s.payment_status && PAYMENT_STATUS[s.payment_status]) || NO_PAYMENT).label },
                  { label: 'Due Date', value: s.due_at ? formatDateTime(s.due_at) : '—' },
                  { label: 'Plan', value: s.plan },
                ]}
              />
            </Card>

            {payment && (
              <Card title={payment.status === 'pending' ? 'Proof of Payment Submitted' : 'Latest Proof of Payment'}>
                <InfoRow label="Channel" value={payment.method} />
                <InfoRow label="Reference" value={payment.reference ?? '—'} />
                <InfoRow label="Submitted by" value={payment.submitted_by ?? 'Clinic Admin'} />
                <InfoRow label="Submitted" value={formatDateTime(payment.submitted_at)} />
                <Button small variant="outline" icon="download-outline" label="Open Proof" style={ui.spacedTop} busy={opening} onPress={openProof} />
                <FormError message={error} />
              </Card>
            )}

            <Card title="Payment Actions">
              {payment?.status === 'pending' ? (
                <View style={ui.rowWrap}>
                  <Button small label="Approve Payment" onPress={() => setKind('approve')} />
                  <Button small variant="danger" label="Reject Payment" onPress={() => setKind('reject')} />
                </View>
              ) : payment?.status === 'verified' ? (
                <Text style={ui.success}>Payment verified.{s.status === 'active' ? ' Subscription active.' : ''}</Text>
              ) : payment?.status === 'rejected' ? (
                <FormError message={`Payment rejected. Waiting for a new proof.${payment.review_note ? ` ${payment.review_note}` : ''}`} />
              ) : (
                <Text style={ui.muted}>No payment proof submitted yet.</Text>
              )}
            </Card>

            <Card title="Payment Workflow">
              <WorkflowSteps
                steps={[
                  { label: 'Plan billed to clinic', done: true },
                  { label: 'Clinic pays externally', done: Boolean(payment) },
                  { label: 'Proof of payment submitted', done: Boolean(payment) },
                  { label: 'System Admin reviews proof', done: payment ? payment.status !== 'pending' : false },
                  { label: 'Subscription activated / renewed', done: payment?.status === 'verified' && s.status === 'active' },
                ]}
              />
            </Card>

            <PlanCard key={s.plan_key} subscription={s} onChanged={subscription.sync} />

            {s.history.length > 1 && (
              <Card title="Payment History">
                {s.history.map((item) => {
                  const status = PAYMENT_STATUS[item.status] ?? NO_PAYMENT;
                  return (
                    <View key={item.id} style={[ui.between, ui.stackItem]}>
                      <Text style={[ui.small, ui.flex]}>
                        {formatDateTime(item.submitted_at)} · {formatMonthly(item.amount)} · {item.method}
                      </Text>
                      <Badge tone={status.tone} label={status.label} />
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        )}
      </ScrollView>
      {kind && s && (
        <DecisionSheet
          subscription={s}
          kind={kind}
          onClose={() => setKind(null)}
          onDone={() => {
            setKind(null);
            subscription.sync();
          }}
        />
      )}
    </AdminScreen>
  );
};

export default AdminSubscriptionDetailScreen;
