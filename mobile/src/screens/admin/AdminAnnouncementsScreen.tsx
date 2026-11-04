// System Notifications (web: pages/admin/AdminAnnouncementsPage.jsx). Publishing sends the
// announcement to everyone in its audience; archiving leaves what they received.
import React, { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { Badge, Button, EmptyState, FormError, LoadState, Pager, Sheet, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { Announcement, ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_STATUS, archiveAnnouncement, fetchAnnouncements, publishAnnouncement } from '../../services/admin';
import { formatDateTime, serverMessage } from '../../services/clinicPortal';

const Separator = () => <View style={ui.stackItem} />;
const audienceLabel = (value: string) => ANNOUNCEMENT_AUDIENCES.find((audience) => audience.id === value)?.label ?? value;

function ConfirmSheet({ kind, announcement, onClose, onDone }: { kind: 'publish' | 'archive'; announcement: Announcement; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPublish = kind === 'publish';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await (isPublish ? publishAnnouncement(announcement.id) : archiveAnnouncement(announcement.id));
      onDone();
    } catch (err) {
      setError(serverMessage(err, 'The announcement could not be updated.'));
      setBusy(false);
    }
  };

  return (
    <Sheet title={isPublish ? 'Publish Announcement' : 'Archive Announcement'} onClose={busy ? () => undefined : onClose}>
      <Text style={ui.title}>{announcement.title}</Text>
      <Text style={ui.muted}>
        {isPublish ? `This goes to ${audienceLabel(announcement.audience).toLowerCase()} now and cannot be edited afterwards.` : 'People who received it keep their notification.'}
      </Text>
      <FormError message={error} />
      <Button label="Confirm" style={ui.spacedTop} busy={busy} onPress={submit} />
    </Sheet>
  );
}

const AdminAnnouncementsScreen = () => {
  const navigation = useNavigation<any>();
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState<{ kind: 'publish' | 'archive'; announcement: Announcement } | null>(null);
  const list = useLoader(() => fetchAnnouncements({ page }), [page], 'Announcements could not be loaded.');
  useRefreshOnFocus(list.sync);

  return (
    <AdminScreen title="System Notifications" active="AdminAnnouncements">
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            <Button icon="add" label="Create Announcement" onPress={() => navigation.navigate('AdminAnnouncementForm')} />
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.data ? <EmptyState icon="megaphone-outline" text="No announcements yet." /> : undefined}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        ItemSeparatorComponent={Separator}
        renderItem={({ item: a }) => {
          const status = ANNOUNCEMENT_STATUS[a.status] ?? ANNOUNCEMENT_STATUS.draft;
          return (
            <View style={ui.listItem}>
              <View style={ui.between}>
                <Text style={[ui.title, ui.flex]}>{a.title}</Text>
                <Badge tone={status.tone} label={status.label} />
              </View>
              <Text style={ui.small}>
                Target: {audienceLabel(a.audience)} · {formatDateTime(a.published_at ?? a.created_at)}
              </Text>
              <Text style={ui.muted}>{a.content}</Text>
              {a.status === 'published' && (
                <View style={ui.rowWrap}>
                  <Button small variant="outline" icon="archive-outline" label="Archive" onPress={() => setActing({ kind: 'archive', announcement: a })} />
                </View>
              )}
              {a.status === 'draft' && (
                <View style={ui.rowWrap}>
                  <Button small variant="outline" icon="create-outline" label="Edit" onPress={() => navigation.navigate('AdminAnnouncementForm', { announcementId: a.id })} />
                  <Button small icon="send-outline" label="Publish" onPress={() => setActing({ kind: 'publish', announcement: a })} />
                </View>
              )}
            </View>
          );
        }}
      />
      {acting && (
        <ConfirmSheet
          kind={acting.kind}
          announcement={acting.announcement}
          onClose={() => setActing(null)}
          onDone={() => {
            setActing(null);
            list.sync();
          }}
        />
      )}
    </AdminScreen>
  );
};

export default AdminAnnouncementsScreen;
