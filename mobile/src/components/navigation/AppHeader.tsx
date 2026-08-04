// src/components/navigation/AppHeader.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

interface AppHeaderProps {
  showMenu?: boolean;
  showNotifications?: boolean;
  showHelp?: boolean;
  showAvatar?: boolean;
  title?: string;
  onMenuPress?: () => void;
  onNotificationPress?: () => void;
  onHelpPress?: () => void;
  onAvatarPress?: () => void;
}

const AppHeader = ({
  showMenu = true,
  showNotifications = true,
  showHelp = true,
  showAvatar = true,
  title = 'BukidnonDental',
  onMenuPress,
  onNotificationPress,
  onHelpPress,
  onAvatarPress,
}: AppHeaderProps) => {
  const navigation = useNavigation();
  const { user } = useAuth();

  const handleMenuPress = () => {
    if (onMenuPress) {
      onMenuPress();
    }
  };

  const handleNotificationPress = () => {
    if (onNotificationPress) {
      onNotificationPress();
    } else {
      // Navigate to notifications
    }
  };

  const handleHelpPress = () => {
    if (onHelpPress) {
      onHelpPress();
    } else {
      // Navigate to help
    }
  };

  const handleAvatarPress = () => {
    if (onAvatarPress) {
      onAvatarPress();
    } else {
      navigation.navigate('Profile' as never);
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {showMenu && (
          <TouchableOpacity onPress={handleMenuPress} style={styles.menuButton}>
            <Icon name="menu-outline" size={28} color="#003f87" />
          </TouchableOpacity>
        )}
        <View style={styles.headerLogo}>
          <Icon name="medkit-outline" size={24} color="#003f87" />
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        {showNotifications && (
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleNotificationPress}
          >
            <Icon name="notifications-outline" size={24} color="#003f87" />
          </TouchableOpacity>
        )}
        {showHelp && (
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleHelpPress}
          >
            <Icon name="help-circle-outline" size={24} color="#003f87" />
          </TouchableOpacity>
        )}
        {showAvatar && (
          <TouchableOpacity
            style={styles.headerAvatar}
            onPress={handleAvatarPress}
          >
            <Text style={styles.headerAvatarText}>
              {user?.name?.charAt(0) || 'M'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#c2c6d4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuButton: {
    padding: 4,
  },
  headerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#003f87',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    padding: 4,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#003f87',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#003f87',
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AppHeader;