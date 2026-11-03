// Notifications for system administrators (web: AdminNotificationsPage).
import React, { useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { Button, EmptyState, FormError, LoadState, ui, useLoader } from '../../components/clinic/ClinicUi';
import { AppNotification, fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notifications';
import { formatDateTime, serverMessage } from '../../services/clinicPortal';

const Separator = () => <View style={ui.stackItem} />;

const AdminNotificationsScreen = () => {
  const navigation = useNavigation<any>();
  const list = useLoader(() => fetchNotifications(), [], 'Notifications could not be loaded.');
  const [error, setError] = useState<string | null>(null);

  const markRead = async (n: AppNotification) => {
    if (n.readAt) return;
    try {
      await markNotificationRead(n.id);
      list.sync();
    } catch (err) {
      setError(serverMessage(err, 'This notification could not be updated.'));
    }
  };

  const openItem = (n: AppNotification) => {
    markRead(n);
    if (n.resource?.type === 'clinic_application' && n.resource.id) {
      navigation.navigate('AdminApplicationDetail', { applicationId: n.resource.id });
    }
  };

  return (
    <AdminScreen title="Notifications" active="AdminNotifications" back>
      <FlatList
        data={list.data?.notifications ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            {(list.data?.unreadCount ?? 0) > 0 && (
              <Button
                small
                variant="outline"
                label="Mark all as read"
                onPress={() =>
                  markAllNotificationsRead()
                    .then(list.sync)
                    .catch((err) => setError(serverMessage(err, 'Notifications could not be updated.')))
                }
              />
            )}
            <FormError message={error} />
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.data ? <EmptyState icon="notifications-off-outline" text="No notifications yet." /> : undefined}
        ItemSeparatorComponent={Separator}
        renderItem={({ item: n }) => (
          <TouchableOpacity style={ui.listItem} onPress={() => openItem(n)} accessibilityRole="button" accessibilityState={{ selected: !n.readAt }}>
            <Text style={ui.title}>
              {n.readAt ? '' : '● '}
              {n.title}
            </Text>
            <Text style={ui.muted}>{n.message}</Text>
            <Text style={ui.small}>{formatDateTime(n.createdAt)}</Text>
          </TouchableOpacity>
        )}
      />
    </AdminScreen>
  );
};

export default AdminNotificationsScreen;
