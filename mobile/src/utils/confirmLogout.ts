import { Alert } from 'react-native';

/** Logout confirmation that warns when offline changes would be lost. */
export const confirmLogout = (unsyncedCount: number, onConfirm: () => void) => {
  const warning =
    unsyncedCount > 0
      ? `You have ${unsyncedCount} change${unsyncedCount === 1 ? '' : 's'} that ${
          unsyncedCount === 1 ? "hasn't" : "haven't"
        } synced yet. Logging out will discard ${unsyncedCount === 1 ? 'it' : 'them'}.\n\n`
      : '';
  Alert.alert('Logout', `${warning}Are you sure you want to logout?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Logout', style: 'destructive', onPress: onConfirm },
  ]);
};
