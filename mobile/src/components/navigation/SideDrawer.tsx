// src/components/navigation/SideDrawer.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
  activeItem?: string;
}

interface MenuItem {
  icon: string;
  label: string;
  route: string;
}

const SideDrawer = ({ visible, onClose, activeItem = 'Home' }: SideDrawerProps) => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const menuItems: MenuItem[] = [
    { icon: 'home-outline', label: 'Home', route: 'Home' },
    { icon: 'location-outline', label: 'Clinics', route: 'Clinics' },
    { icon: 'calendar-outline', label: 'Appointments', route: 'Appointments' },
    { icon: 'person-outline', label: 'Profile', route: 'Profile' },
  ];

  const handleMenuItemPress = (item: MenuItem) => {
    onClose();
    if (item.route !== activeItem) {
      navigation.navigate(item.route as never);
    }
  };

  const handleLogout = () => {
    onClose();
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.drawerContainer}>
          {/* Drawer Header */}
          <View style={styles.drawerHeader}>
            <View style={styles.drawerLogo}>
              <Icon name="medkit-outline" size={32} color="#fff" />
            </View>
            <View>
              <Text style={styles.drawerTitle}>BukidnonDental</Text>
              <Text style={styles.drawerSubtitle}>Clinical Excellence</Text>
            </View>
          </View>

          {/* Drawer Menu */}
          <View style={styles.drawerMenu}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.drawerMenuItem,
                  activeItem === item.label && styles.drawerMenuItemActive,
                ]}
                onPress={() => handleMenuItemPress(item)}
                activeOpacity={0.7}
              >
                <Icon
                  name={item.icon as any}
                  size={24}
                  color={activeItem === item.label ? '#003f87' : '#424752'}
                />
                <Text
                  style={[
                    styles.drawerMenuText,
                    activeItem === item.label && styles.drawerMenuTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.drawerDivider} />

            <TouchableOpacity
              style={styles.drawerMenuItem}
              onPress={() => {
                onClose();
                // Navigate to support
              }}
              activeOpacity={0.7}
            >
              <Icon name="help-circle-outline" size={24} color="#424752" />
              <Text style={styles.drawerMenuText}>Support</Text>
            </TouchableOpacity>
          </View>

          {/* Drawer Footer - User Profile */}
          <View style={styles.drawerFooter}>
            <View style={styles.drawerProfile}>
              <View style={styles.drawerAvatar}>
                <Text style={styles.drawerAvatarText}>
                  {user?.name?.charAt(0) || 'M'}
                </Text>
              </View>
              <View style={styles.drawerProfileInfo}>
                <Text style={styles.drawerProfileName}>
                  {user?.name || 'Maria Santos'}
                </Text>
                <Text style={styles.drawerProfileBadge}>Premium Member</Text>
              </View>
              <TouchableOpacity onPress={handleLogout} style={styles.drawerLogout}>
                <Icon name="log-out-outline" size={20} color="#727784" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(24,28,32,0.4)',
  },
  drawerContainer: {
    width: width * 0.75,
    height: '100%',
    backgroundColor: '#f1f4f9',
    padding: 16,
    justifyContent: 'space-between',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    paddingVertical: 8,
  },
  drawerLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#003f87',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#003f87',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  drawerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#424752',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  drawerMenu: {
    flex: 1,
    gap: 4,
  },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  drawerMenuItemActive: {
    backgroundColor: '#d7e2ff',
  },
  drawerMenuText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#424752',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  drawerMenuTextActive: {
    color: '#003f87',
    fontWeight: '700',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#c2c6d4',
    marginVertical: 8,
  },
  drawerFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#c2c6d4',
  },
  drawerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  drawerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#003f87',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  drawerProfileInfo: {
    flex: 1,
  },
  drawerProfileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#181c20',
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  drawerProfileBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#424752',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  drawerLogout: {
    padding: 4,
  },
});

export default SideDrawer;