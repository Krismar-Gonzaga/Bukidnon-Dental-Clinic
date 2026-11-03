// Patient reviews (web: ClinicReviewsPage). Clinics see all their reviews
// and can report inappropriate ones to the platform moderators; they cannot
// edit or delete reviews.
import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, Button, EmptyState, Field, FormError, LoadState, Pager, Sheet, ui, useLoader } from '../../components/clinic/ClinicUi';
import { ClinicReview, fetchClinicReviews, reportReview, serverMessage } from '../../services/clinicPortal';
import { formatDateKey } from '../../services/booking';
import { palette } from '../../theme/tokens';

const STATUS_LABELS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  approved: { label: 'Published', tone: 'success' },
  pending: { label: 'Awaiting moderation', tone: 'warning' },
  rejected: { label: 'Hidden', tone: 'neutral' },
};

const Stars = ({ rating }: { rating: number }) => (
  <View style={styles.stars} accessible accessibilityLabel={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Icon key={n} name={n <= rating ? 'star' : 'star-outline'} size={16} color="#b7791f" />
    ))}
  </View>
);

const ClinicReviewsScreen = () => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const [page, setPage] = useState(1);
  const list = useLoader(() => fetchClinicReviews(clinicId, page), [clinicId, page], 'Reviews could not be loaded.');
  const [reporting, setReporting] = useState<ClinicReview | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!reporting) return;
    setBusy(true);
    setError(null);
    try {
      await reportReview(clinicId, reporting.id, reason.trim());
      setReporting(null);
      setReason('');
      list.sync();
    } catch (err) {
      setError(serverMessage(err, 'The report could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClinicScreen title="Reviews" active="ClinicReviews">
      <FlatList
        data={list.loading ? [] : list.data?.items ?? []}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} colors={[palette.primary]} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            <Text style={ui.heading}>Patient reviews</Text>
            <Text style={ui.muted}>Published reviews appear on your clinic page.</Text>
            <LoadState loading={list.loading} error={list.data ? null : list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="star-outline" text="No reviews yet." />}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        renderItem={({ item }) => {
          const status = STATUS_LABELS[item.status] ?? { label: item.status, tone: 'neutral' as const };
          return (
            <View style={ui.listItem}>
              <View style={ui.between}>
                <Stars rating={item.rating} />
                <Badge tone={status.tone} label={status.label} />
              </View>
              <Text style={ui.small}>
                {item.patient_name}
                {item.date ? ` · ${formatDateKey(item.date, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                {item.is_verified_visit ? ' · Verified visit' : ''}
              </Text>
              {item.comment ? <Text style={ui.muted}>{item.comment}</Text> : null}
              {item.status === 'approved' && <Button small variant="outline" icon="flag-outline" label="Report" onPress={() => setReporting(item)} />}
            </View>
          );
        }}
      />
      {reporting && (
        <Sheet title="Report review" onClose={() => setReporting(null)}>
          <Field label="Why should a moderator look at this?" required multiline maxLength={500} value={reason} onChangeText={setReason} />
          <FormError message={error} />
          <Button label="Send report" style={ui.spacedTop} busy={busy} disabled={!reason.trim()} onPress={send} />
        </Sheet>
      )}
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 2 },
});

export default ClinicReviewsScreen;
