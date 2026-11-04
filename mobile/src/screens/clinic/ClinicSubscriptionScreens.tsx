// Subscription and proof of payment (web: ClinicSubscriptionPage,
// ClinicPaymentProofPage). There is no online payment: the clinic transfers the
// money, uploads proof, and a system administrator verifies it.
import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { NoteBox, StatRow, SuccessBlock } from '../../components/clinic/ClinicAdminKit';
import { Badge, Button, Card, Chips, EmptyState, Field, FormError, LoadState, Sheet, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import {
  fetchSubscription,
  formatDateTime,
  formatPeso,
  invoiceUrl,
  PickedFile,
  requestRenewal,
  serverMessage,
  submitPaymentProof,
  SubscriptionPayment,
} from '../../services/clinicPortal';
import { palette, radius, spacing, type } from '../../theme/tokens';

const PLAN_STATUS: Record<string, { label: string; tone: 'success' | 'danger' | 'neutral' }> = {
  active: { label: 'Active', tone: 'success' },
  expired: { label: 'Expired', tone: 'danger' },
  none: { label: 'Not started', tone: 'neutral' },
};

const PAYMENT_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  pending: { label: 'Pending', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

const dateOnly = (iso?: string | null) => formatDateTime(iso).split(',').slice(0, 2).join(',');

export const ClinicSubscriptionScreen = () => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const subscription = useLoader(() => fetchSubscription(clinicId), [clinicId], 'Your subscription could not be loaded.');
  useRefreshOnFocus(subscription.sync);
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = subscription.data;
  const status = PLAN_STATUS[data?.status ?? 'none'] ?? PLAN_STATUS.none;

  const renew = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestRenewal(clinicId);
      setAsking(false);
      setSent(true);
    } catch (err) {
      setError(serverMessage(err, 'The request could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  const openInvoice = async (payment: SubscriptionPayment) => {
    setError(null);
    try {
      await Linking.openURL(await invoiceUrl(clinicId, payment.id));
    } catch (err) {
      setError(serverMessage(err, 'The invoice could not be opened.'));
    }
  };

  return (
    <ClinicScreen title="Subscription" active="ClinicSubscription">
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={subscription.refreshing} onRefresh={subscription.refresh} colors={[palette.primary]} />}>
        <LoadState loading={subscription.loading} error={data ? null : subscription.error} onRetry={subscription.reload} />
        {data && (
          <>
            <Card>
              <View style={ui.between}>
                <View style={ui.flex}>
                  <View style={ui.rowWrap}>
                    <Text style={styles.planName}>{data.plan.name}</Text>
                    <Badge tone={status.tone} label={status.label} />
                  </View>
                  <Text style={ui.small}>
                    {membership?.clinic_name} · {data.plan.billing}
                  </Text>
                </View>
                <View>
                  <Text style={styles.price}>{formatPeso(data.plan.price)}</Text>
                  <Text style={[ui.small, styles.end]}>per month</Text>
                </View>
              </View>
              <StatRow label="Subscription Status" value={status.label} />
              <StatRow label="Next Renewal Date" value={data.renews_at ? dateOnly(data.renews_at) : null} />
              <StatRow label="Days Remaining" value={data.days_remaining != null ? `${data.days_remaining} days` : null} />
              <Text style={styles.label}>Plan Features</Text>
              {data.plan.features.map((feature) => (
                <View key={feature} style={ui.row}>
                  <Icon name="checkmark-circle-outline" size={18} color="#00a35c" />
                  <Text style={ui.muted}>{feature}</Text>
                </View>
              ))}
              {data.has_pending_payment && <NoteBox tone="info">A payment proof is waiting for review. You can send another once it has been reviewed.</NoteBox>}
              {sent && <NoteBox tone="success">Your renewal request was sent to the system administrators.</NoteBox>}
              <FormError message={!asking ? error : null} />
              {!data.has_pending_payment && <Button icon="cloud-upload-outline" label="Upload Payment Proof" onPress={() => navigation.navigate('ClinicPaymentProof')} />}
              <Button
                variant="outline"
                icon="refresh-outline"
                label="Request Renewal"
                onPress={() => {
                  setError(null);
                  setAsking(true);
                }}
              />
            </Card>

            <Card title="Billing History">
              {data.payments.length === 0 && <EmptyState icon="receipt-outline" text="No payments yet." />}
              {data.payments.map((payment) => {
                const tone = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS.pending;
                return (
                  <View key={payment.id} style={ui.listItem}>
                    <View style={ui.between}>
                      <Text style={[ui.title, ui.flex]}>{payment.description}</Text>
                      <Badge tone={tone.tone} label={tone.label} />
                    </View>
                    <Text style={ui.muted}>
                      {dateOnly(payment.date)} · {formatPeso(payment.amount)}
                    </Text>
                    {payment.invoice_number ? <Text style={ui.small}>{payment.invoice_number}</Text> : null}
                    {payment.status === 'rejected' && payment.review_note ? <Text style={ui.small}>{payment.review_note}</Text> : null}
                    {payment.status === 'verified' && <Button small variant="outline" icon="document-text-outline" label="PDF" onPress={() => openInvoice(payment)} />}
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
      {asking && (
        <Sheet title="Request renewal?" onClose={() => setAsking(false)}>
          <Text style={ui.muted}>The system administrators will be told you want to renew this plan.</Text>
          <FormError message={error} />
          <Button label="Request Renewal" style={ui.spacedTop} busy={busy} onPress={renew} />
        </Sheet>
      )}
    </ClinicScreen>
  );
};

const MAX_BYTES = 5 * 1024 * 1024;

const NEXT_STEPS = [
  'Your payment proof is queued for admin review',
  'Verification typically takes 1–2 business days',
  'You will receive an email once your subscription is renewed',
  'Your clinic dashboard will remain active during the review period',
];

export const ClinicPaymentProofScreen = () => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const subscription = useLoader(() => fetchSubscription(clinicId), [clinicId], 'Payment details could not be loaded.');
  const [method, setMethod] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = subscription.data;
  const activeMethod = method ?? data?.channels[0]?.key ?? '';
  const channel = data?.channels.find(({ key }) => key === activeMethod);

  const choose = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > MAX_BYTES) {
      setError('Please choose a file of 5 MB or less.');
      return;
    }
    setProof({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/pdf' });
  };

  const submit = async () => {
    if (!proof) return;
    setBusy(true);
    setError(null);
    try {
      await submitPaymentProof(clinicId, { method: activeMethod, reference: reference.trim(), proof });
      setSubmitted(true);
    } catch (err) {
      setError(serverMessage(err, 'Your proof could not be submitted.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClinicScreen title={submitted ? 'Subscription' : 'Submit Proof of Payment'} active="ClinicSubscription" back>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        {submitted ? (
          <Card>
            <SuccessBlock title="Payment Proof Submitted!" action={<Button label="Back to Subscription" style={styles.stretch} onPress={() => navigation.goBack()} />}>
              <Text style={[ui.muted, styles.center]}>Your proof of payment has been successfully submitted. Our System Administrator will review and verify your payment before activating or renewing your subscription.</Text>
              <View style={styles.steps}>
                <Text style={styles.stepsTitle}>What happens next?</Text>
                {NEXT_STEPS.map((step, index) => (
                  <Text key={step} style={ui.small}>
                    {index + 1}. {step}
                  </Text>
                ))}
              </View>
            </SuccessBlock>
          </Card>
        ) : (
          <>
            <LoadState loading={subscription.loading} error={data ? null : subscription.error} onRetry={subscription.reload} />
            {data?.has_pending_payment && <NoteBox tone="info">A payment proof is already waiting for review. You can send another once it has been reviewed.</NoteBox>}
            {data && !data.has_pending_payment && (
              <Card title="Submit Payment Proof">
                <Chips options={data.channels.map(({ key, label }) => ({ id: key, label }))} value={activeMethod} onChange={setMethod} scroll={false} />
                {channel && (
                  <View style={styles.channel}>
                    <Text style={styles.label}>{channel.label} payment details</Text>
                    <StatRow label={channel.number_label} value={channel.number || 'Ask your system administrator'} />
                    <StatRow label="Account Name" value={channel.account_name} />
                    <StatRow label="Reference" value={`Use your Clinic ID (${clinicId}) as reference`} />
                  </View>
                )}
                <Text style={styles.label}>Upload Screenshot / Receipt</Text>
                <TouchableOpacity style={styles.dropzone} onPress={choose} accessibilityRole="button" accessibilityLabel="Choose your receipt">
                  <Icon name="cloud-upload-outline" size={28} color={palette.onSurfaceVariant} />
                  <Text style={ui.muted}>{proof ? proof.name : 'Tap to browse'}</Text>
                  <Text style={ui.small}>JPG, PNG, or PDF · Max 5MB</Text>
                </TouchableOpacity>
                <Field label="Reference number (optional)" maxLength={120} placeholder="Transaction / reference number" value={reference} onChangeText={setReference} />
                <NoteBox>Payment is made outside this app through the channels above. Submit your proof after completing the transfer.</NoteBox>
                <FormError message={error} />
                <Button label="Submit Proof" busy={busy} disabled={!proof || !activeMethod} onPress={submit} />
                <Button variant="outline" label="Cancel" onPress={() => navigation.goBack()} />
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  planName: { ...type.titleLg, fontWeight: '700', color: palette.onSurface },
  price: { ...type.titleLg, fontWeight: '700', color: palette.primary, textAlign: 'right' },
  end: { textAlign: 'right' },
  center: { textAlign: 'center' },
  stretch: { alignSelf: 'stretch' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: palette.onSurfaceVariant, marginTop: spacing.sm },
  channel: { padding: spacing.sm, borderRadius: radius.xl, backgroundColor: palette.surface },
  dropzone: { alignItems: 'center', gap: spacing.xs, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 2, borderStyle: 'dashed', borderColor: palette.outlineVariant },
  steps: { alignSelf: 'stretch', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.primaryFixedDim, backgroundColor: '#eef4ff' },
  stepsTitle: { ...type.bodyMd, fontWeight: '700', color: palette.primary },
});
