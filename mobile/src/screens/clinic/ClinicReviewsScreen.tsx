// Reviews & Feedback (web: ClinicReviewsPage): overall rating, each review, a
// public reply and a report to the moderators. Clinics cannot edit or delete reviews.
import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { InitialsTile } from '../../components/clinic/ClinicAdminKit';
import { Badge, Button, EmptyState, Field, FormError, LoadState, Pager, SelectField, Sheet, ui, useLoader } from '../../components/clinic/ClinicUi';
import { can, ClinicReview, fetchClinicReviews, replyToReview, reportReview, ReviewSummary, serverMessage } from '../../services/clinicPortal';
import { formatDateKey } from '../../services/booking';
import { palette, radius, spacing } from '../../theme/tokens';

const STAR = '#f5843c';
const REPORT_REASONS = ['Spam or fake review', 'Offensive or abusive language', 'Not about this clinic', 'Contains private information', 'Other'].map((id) => ({ id, label: id }));

const Stars = ({ rating }: { rating: number }) => (
  <View style={styles.stars} accessible accessibilityLabel={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Icon key={n} name="star" size={15} color={n <= rating ? STAR : palette.surfaceContainerHighest} />
    ))}
  </View>
);

function OverallRating({ summary }: { summary?: ReviewSummary }) {
  const count = summary?.count ?? 0;
  const average = Number(summary?.average ?? 0);
  return (
    <View style={ui.listItem}>
      <Text style={ui.heading}>Overall Rating</Text>
      <View style={styles.ratingTop}>
        <Stars rating={Math.round(average)} />
        <Text style={styles.ratingValue}>{average.toFixed(1)}</Text>
      </View>
      <Text style={[ui.small, styles.center]}>
        {count} {count === 1 ? 'review' : 'reviews'}
      </Text>
      {[5, 4, 3, 2, 1].map((stars) => {
        const total = summary?.breakdown?.[stars] ?? 0;
        return (
          <View key={stars} style={styles.bar}>
            <Text style={ui.small}>{stars}</Text>
            <Icon name="star" size={13} color={STAR} />
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${count > 0 ? (total / count) * 100 : 0}%` }]} />
            </View>
            <Text style={ui.small}>{total}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ReviewCard({ item, clinicId, canRespond, onReport, onChanged }: { item: ClinicReview; clinicId: number; canRespond: boolean; onReport: () => void; onChanged: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPublished = item.status === 'approved';

  const post = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await replyToReview(clinicId, item.id, draft.trim());
      setDraft(null);
      onChanged();
    } catch (err) {
      setError(serverMessage(err, 'Your reply could not be posted.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={ui.listItem}>
      <View style={ui.row}>
        <InitialsTile name={item.patient_name} />
        <View style={ui.flex}>
          <Text style={ui.title}>{item.patient_name}</Text>
          <Text style={ui.small}>{[item.service, item.dentist].filter(Boolean).join(' · ')}</Text>
          <Stars rating={item.rating} />
        </View>
      </View>
      <View style={ui.between}>
        <Text style={ui.small}>{item.date ? formatDateKey(item.date, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}</Text>
        {isPublished ? <Button small variant="outline" label="Report" onPress={onReport} /> : <Badge tone="neutral" label={item.status === 'rejected' ? 'Hidden' : 'Pending'} />}
      </View>
      {item.comment ? <Text style={ui.muted}>{item.comment}</Text> : null}
      {item.clinic_reply ? (
        <View style={styles.response}>
          <Text style={styles.responseTitle}>Clinic Response</Text>
          <Text style={ui.small}>{item.clinic_reply}</Text>
        </View>
      ) : null}
      {canRespond && isPublished && !item.clinic_reply ? (
        draft === null ? (
          <Button small variant="tonal" icon="chatbox-outline" label="Reply to this review" onPress={() => setDraft('')} />
        ) : (
          <>
            <Field label={`Your reply to ${item.patient_name}`} multiline required maxLength={1000} placeholder="Write your reply…" value={draft} onChangeText={setDraft} />
            <FormError message={error} />
            <View style={ui.rowWrap}>
              <Button small label="Post Reply" busy={busy} disabled={!draft.trim()} onPress={post} />
              <Button small variant="outline" label="Cancel" onPress={() => setDraft(null)} />
            </View>
          </>
        )
      ) : null}
    </View>
  );
}

const ClinicReviewsScreen = () => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const [page, setPage] = useState(1);
  const list = useLoader(() => fetchClinicReviews(clinicId, page), [clinicId, page], 'Reviews could not be loaded.');
  const [reporting, setReporting] = useState<ClinicReview | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRespond = can(membership, 'feedback.respond');

  const send = async () => {
    if (!reporting || !reason) return;
    setBusy(true);
    setError(null);
    try {
      await reportReview(clinicId, reporting.id, reason);
      setReporting(null);
      setReason(null);
      list.sync();
    } catch (err) {
      setError(serverMessage(err, 'The report could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClinicScreen title="Reviews & Feedback" active="ClinicReviews">
      <FlatList
        data={list.loading ? [] : list.data?.items ?? []}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} colors={[palette.primary]} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            <LoadState loading={list.loading} error={list.data ? null : list.error} onRetry={list.reload} />
            {list.data && <OverallRating summary={list.data.meta.summary} />}
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="star-outline" text="No reviews yet." />}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        renderItem={({ item }) => <ReviewCard item={item} clinicId={clinicId} canRespond={canRespond} onReport={() => setReporting(item)} onChanged={list.sync} />}
      />
      {reporting && (
        <Sheet title="Report Review" onClose={() => setReporting(null)}>
          <Text style={ui.muted}>Select the reason for reporting this review. Our moderation team will review it.</Text>
          <SelectField label="Reason" required value={reason} onChange={setReason} options={REPORT_REASONS} />
          <FormError message={error} />
          <Button label="Submit Report" variant="danger" style={ui.spacedTop} busy={busy} disabled={!reason} onPress={send} />
        </Sheet>
      )}
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 2 },
  center: { textAlign: 'center' },
  ratingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  ratingValue: { fontSize: 40, fontWeight: '700', color: palette.primary },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: palette.surfaceContainerHigh },
  fill: { height: '100%', backgroundColor: STAR },
  response: { padding: spacing.sm, borderRadius: radius.xl, backgroundColor: palette.primaryFixed },
  responseTitle: { fontSize: 13, fontWeight: '700', color: palette.primary },
});

export default ClinicReviewsScreen;
