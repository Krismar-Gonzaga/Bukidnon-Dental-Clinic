// Status strip for the offline-first layer: offline, syncing queued changes, or
// changes the server rejected. Renders nothing when online and fully synced.
import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSync } from '../../context/SyncContext';
import { palette, spacing, type } from '../../theme/tokens';
import { timeAgo } from '../../utils/format';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const OfflineBanner = () => {
  const {
    isOnline,
    isSyncing,
    lastSyncedAt,
    pendingCount,
    failedCount,
    syncNow,
    retryFailedChanges,
    discardFailedChanges,
  } = useSync();

  if (!isOnline) {
    const pending = pendingCount > 0 ? ` · ${plural(pendingCount, 'change')} waiting` : '';
    return (
      <TouchableOpacity
        style={[styles.banner, styles.offline]}
        onPress={() => syncNow()}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="You are offline. Tap to retry the connection."
      >
        {isSyncing ? (
          <ActivityIndicator size="small" color={palette.inverseOnSurface} />
        ) : (
          <Icon name="cloud-offline-outline" size={16} color={palette.inverseOnSurface} />
        )}
        <Text style={[styles.text, styles.offlineText]} numberOfLines={2}>
          Offline · saved data from {timeAgo(lastSyncedAt)}
          {pending}
        </Text>
        <Text style={[styles.action, styles.offlineText]}>Retry</Text>
      </TouchableOpacity>
    );
  }

  if (isSyncing && pendingCount > 0) {
    return (
      <View style={[styles.banner, styles.syncing]}>
        <ActivityIndicator size="small" color={palette.primary} />
        <Text style={[styles.text, styles.syncingText]}>
          Syncing {plural(pendingCount, 'change')}…
        </Text>
      </View>
    );
  }

  if (failedCount > 0) {
    const handlePress = () =>
      Alert.alert(
        'Changes not synced',
        `The server rejected ${plural(failedCount, 'change')} you made offline (for example, the time slot may no longer be available).`,
        [
          { text: 'Keep for now', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => discardFailedChanges() },
          { text: 'Retry', onPress: () => retryFailedChanges() },
        ],
      );
    return (
      <TouchableOpacity style={[styles.banner, styles.failed]} onPress={handlePress} activeOpacity={0.8}>
        <Icon name="alert-circle-outline" size={16} color={palette.onErrorContainer} />
        <Text style={[styles.text, styles.failedText]}>
          {plural(failedCount, 'change')} couldn't sync
        </Text>
        <Text style={[styles.action, styles.failedText]}>Review</Text>
      </TouchableOpacity>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.base,
  },
  text: {
    ...type.labelMd,
    letterSpacing: 0.2,
    flex: 1,
  },
  action: {
    ...type.labelMd,
    textDecorationLine: 'underline',
  },
  offline: { backgroundColor: palette.inverseSurface },
  offlineText: { color: palette.inverseOnSurface },
  syncing: { backgroundColor: palette.primaryFixed },
  syncingText: { color: palette.onPrimaryFixedVariant },
  failed: { backgroundColor: palette.errorContainer },
  failedText: { color: palette.onErrorContainer },
});

export default OfflineBanner;
