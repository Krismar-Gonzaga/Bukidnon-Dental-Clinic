// Review moderation (web: pages/admin/AdminReviewsPage.jsx). Moderation keeps
// the review and its reports; it only publishes or hides it. A note is
// required and the password is re-confirmed (423).
import React, { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { actionError, PasswordPrompt, useSensitiveAction } from '../../components/admin/AdminSecurity';
import { Badge, Button, EmptyState, Field, FormError, LoadState, Pager, Sheet, Toggle, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { fetchModerationQueue, moderateReview, ModerationReview } from '../../services/admin';

const Separator = () => <View style={ui.stackItem} />;

const statusText = (status: string) => (status === 'approved' ? 'Published' : status === 'rejected' ? 'Hidden' : 'Awaiting moderation');

function ModerateSheet({ review, onClose, onDone }: { review: ModerationReview; onClose: () => void; onDone: () => void }) {
  const sensitive = useSensitiveAction();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (status: 'approved' | 'rejected') => {
    setBusy(status);
    setError(null);
    try {
      await sensitive.run(() => moderateReview(review.id, status, note.trim()));
      onDone();
    } catch (err) {
      setError(actionError(err, 'The review could not be moderated.'));
      setBusy(null);
    }
  };

  return (
    <Sheet title="Moderate review" onClose={busy ? () => undefined : onClose}>
      <Text style={ui.title}>
        {review.rating}/5 · {review.clinic_name}
      </Text>
      <Text style={ui.muted}>{review.comment || 'No comment.'}</Text>
      {(review.reports ?? []).map((r) => (
        <Text key={r.id} style={ui.small}>Reported: {r.reason}</Text>
      ))}
      <Field label="Moderator note (recorded)" required multiline maxLength={1000} value={note} onChangeText={setNote} />
      <FormError message={error} />
      <PasswordPrompt sensitive={sensitive} inline />
      {!sensitive.asking && (
        <View style={[ui.rowWrap, ui.spacedTop]}>
          <Button small variant="danger" label="Hide review" busy={busy === 'rejected'} disabled={!note.trim() || Boolean(busy)} onPress={() => decide('rejected')} />
          <Button small label="Keep published" busy={busy === 'approved'} disabled={!note.trim() || Boolean(busy)} onPress={() => decide('approved')} />
        </View>
      )}
    </Sheet>
  );
}

const AdminReviewsScreen = () => {
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [moderating, setModerating] = useState<ModerationReview | null>(null);
  const list = useLoader(() => fetchModerationQueue({ all: showAll ? 1 : undefined, page }), [showAll, page], 'Reviews could not be loaded.');
  useRefreshOnFocus(list.sync);

  return (
    <AdminScreen title="Review Moderation" active="AdminReviews">
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            <Toggle label="Show all reviews" hint="Off: only reviews with open reports" value={showAll} onChange={(v) => { setShowAll(v); setPage(1); }} />
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.data ? <EmptyState icon="star-outline" text={showAll ? 'No reviews.' : 'No open reports.'} /> : undefined}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        ItemSeparatorComponent={Separator}
        renderItem={({ item: r }) => (
          <View style={ui.listItem}>
            <View style={ui.between}>
              <Text style={[ui.title, ui.flex]} numberOfLines={1}>
                {r.rating}/5 · {r.clinic_name}
              </Text>
              <Badge status={r.status === 'approved' ? 'published' : r.status} label={statusText(r.status)} />
            </View>
            <Text style={ui.small}>
              {r.patient_name} · {r.date}
              {r.open_reports > 0 ? ` · ${r.open_reports} open report${r.open_reports === 1 ? '' : 's'}` : ''}
            </Text>
            {r.comment ? <Text style={ui.muted}>{r.comment}</Text> : null}
            {r.moderation_note ? <Text style={ui.small}>Moderator note: {r.moderation_note}</Text> : null}
            <Button small variant="outline" label="Moderate" onPress={() => setModerating(r)} />
          </View>
        )}
      />
      {moderating && (
        <ModerateSheet
          review={moderating}
          onClose={() => setModerating(null)}
          onDone={() => {
            setModerating(null);
            list.sync();
          }}
        />
      )}
    </AdminScreen>
  );
};

export default AdminReviewsScreen;
