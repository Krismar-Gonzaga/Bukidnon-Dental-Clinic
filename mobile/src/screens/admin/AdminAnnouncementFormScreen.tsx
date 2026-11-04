// Create Announcement (web: pages/admin/AdminAnnouncementFormPage.jsx), or edit a draft.
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { Button, Card, Field, FormError, LoadState, SelectField, ui, useLoader } from '../../components/clinic/ClinicUi';
import { ANNOUNCEMENT_AUDIENCES, fetchAnnouncement, saveAnnouncement } from '../../services/admin';
import { serverMessage } from '../../services/clinicPortal';

const AdminAnnouncementFormScreen = ({ route }: { route?: { params?: { announcementId?: number } } }) => {
  const announcementId = route?.params?.announcementId ?? null;
  const navigation = useNavigation<any>();
  const existing = useLoader(() => (announcementId ? fetchAnnouncement(announcementId) : Promise.resolve(null)), [announcementId], 'This announcement could not be loaded.');
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState('all');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing.data) {
      setTitle(existing.data.title);
      setAudience(existing.data.audience);
      setContent(existing.data.content);
    }
  }, [existing.data]);

  const save = async (publish: boolean) => {
    setBusy(publish ? 'publish' : 'draft');
    setError(null);
    try {
      await saveAnnouncement(announcementId, { title: title.trim(), audience, content: content.trim(), publish });
      navigation.goBack();
    } catch (err) {
      setError(serverMessage(err, 'The announcement could not be saved.'));
      setBusy(null);
    }
  };
  const ready = Boolean(title.trim() && content.trim());

  return (
    <AdminScreen title={announcementId ? 'Edit Announcement' : 'Create Announcement'} active="AdminAnnouncementForm" back>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        {announcementId && !existing.data ? (
          <LoadState loading={existing.loading} error={existing.error} onRetry={existing.reload} />
        ) : (
          <Card>
            <Field label="Title" required maxLength={150} placeholder="Announcement title" value={title} onChangeText={setTitle} />
            <SelectField label="Target Audience" options={ANNOUNCEMENT_AUDIENCES} value={audience} onChange={setAudience} />
            <Field label="Content" required multiline maxLength={5000} placeholder="Write your announcement..." value={content} onChangeText={setContent} />
            <FormError message={error} />
            <View style={[ui.rowWrap, ui.spacedTop]}>
              <Button small variant="outline" label="Save as Draft" busy={busy === 'draft'} disabled={!ready || busy !== null} onPress={() => save(false)} />
              <Button small icon="send-outline" label="Publish Now" busy={busy === 'publish'} disabled={!ready || busy !== null} onPress={() => save(true)} />
            </View>
          </Card>
        )}
      </ScrollView>
    </AdminScreen>
  );
};

export default AdminAnnouncementFormScreen;
