// Frame of the signed-in patient pages: the website's top bar (menu, page title, bell,
// avatar), the offline strip, and the sidebar as a slide-in menu.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import OfflineBanner from '../common/OfflineBanner';
import { guestColors, initialOf } from '../guest/GuestUi';
import { BRAND_NAME } from '../../content/guestContent';
import { useAuth } from '../../context/AuthContext';
import { fetchUnreadCount } from '../../services/notifications';
import { spacing } from '../../theme/tokens';

export type PatientRoute =
  | 'Home'
  | 'BookAppointment'
  | 'Appointments'
  | 'Notifications'
  | 'GuestClinics'
  | 'SavedClinics'
  | 'ClinicLocator'
  | 'Profile';

export const PATIENT_MENU: Array<{ route: PatientRoute; label: string; icon: string }> = [
  { route: 'Home', label: 'Dashboard', icon: 'grid-outline' },
  { route: 'BookAppointment', label: 'Book Appointment', icon: 'calendar-outline' },
  { route: 'Appointments', label: 'Appointment History', icon: 'time-outline' },
  { route: 'Notifications', label: 'Notifications', icon: 'notifications-outline' },
  { route: 'GuestClinics', label: 'Find Clinics', icon: 'business-outline' },
  { route: 'SavedClinics', label: 'Saved Clinics', icon: 'heart-outline' },
  { route: 'ClinicLocator', label: 'Clinic Locator', icon: 'map-outline' },
  { route: 'Profile', label: 'My Profile', icon: 'person-outline' },
];

/** Top-level pages replace each other, so the back button never unwinds a menu history. */
export const goToPatientPage = (navigation: any, route: PatientRoute, current?: PatientRoute) => {
  if (route === current) {
    return;
  }
  if (route === 'Home') {
    navigation.popToTop();
    return;
  }
  navigation.popTo(route);
};

type PatientShellProps = {
  navigation: any;
  title: string;
  /** Which menu entry this page belongs to. */
  active?: PatientRoute;
  children: React.ReactNode;
};

const DRAWER_ANIMATION_MS = 220;

const PatientShell = ({ navigation, title, active, children }: PatientShellProps) => {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const drawerWidth = Math.min(Dimensions.get('window').width * 0.82, 320);
  const translateX = useRef(new Animated.Value(-drawerWidth)).current;
  const name = user?.name ?? '';

  useEffect(() => {
    const refresh = () => {
      fetchUnreadCount()
        .then((count) => setHasUnread(count > 0))
        .catch(() => undefined); // Offline: the dot simply stays as it was.
    };
    refresh();
    return navigation.addListener?.('focus', refresh);
  }, [navigation]);

  useEffect(() => {
    if (menuOpen) {
      setMounted(true);
      Animated.timing(translateX, { toValue: 0, duration: DRAWER_ANIMATION_MS, useNativeDriver: true }).start();
    } else {
      Animated.timing(translateX, { toValue: -drawerWidth, duration: DRAWER_ANIMATION_MS, useNativeDriver: true }).start(() =>
        setMounted(false),
      );
    }
  }, [menuOpen, drawerWidth, translateX]);

  const choose = (route: PatientRoute) => {
    setMenuOpen(false);
    goToPatientPage(navigation, route, active);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.menuButton} onPress={() => setMenuOpen(true)} accessibilityLabel="Open menu">
          <Icon name="menu" size={24} color={guestColors.primary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <TouchableOpacity
          style={styles.bell}
          onPress={() => goToPatientPage(navigation, 'Notifications', active)}
          hitSlop={8}
          accessibilityLabel={hasUnread ? 'Notifications, unread' : 'Notifications'}
        >
          <Icon name="notifications-outline" size={24} color={guestColors.text} />
          {hasUnread && <View style={styles.dot} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => goToPatientPage(navigation, 'Profile', active)}
          accessibilityLabel="My Profile"
        >
          <Text style={styles.avatarText}>{initialOf(name) || '?'}</Text>
        </TouchableOpacity>
      </View>
      <OfflineBanner />

      {children}

      <Modal visible={mounted} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu">
            <View style={styles.scrim} />
          </Pressable>
          <Animated.View
            style={[
              styles.drawer,
              { width: drawerWidth, paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom, transform: [{ translateX }] },
            ]}
          >
            <Text style={styles.brand}>{BRAND_NAME}</Text>
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialOf(name) || '?'}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.userName} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.userRole}>Patient</Text>
              </View>
            </View>
            <View style={styles.nav}>
              {PATIENT_MENU.map((item) => {
                const isActive = item.route === active;
                return (
                  <TouchableOpacity
                    key={item.route}
                    style={[styles.navItem, isActive && styles.navItemActive]}
                    onPress={() => choose(item.route)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Icon name={item.icon} size={20} color={isActive ? '#ffffff' : guestColors.text} />
                    <Text style={[styles.navText, isActive && styles.navTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={styles.logout}
              onPress={() => {
                setMenuOpen(false);
                logout();
              }}
              accessibilityRole="button"
            >
              <Icon name="log-out-outline" size={20} color={guestColors.error} />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: guestColors.background },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.marginMobile,
    backgroundColor: guestColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: guestColors.border,
  },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: guestColors.border,
  },
  title: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '700', color: guestColors.text },
  bell: { padding: spacing.xs },
  dot: {
    position: 'absolute',
    top: 3,
    right: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#ef3b3b',
    borderWidth: 1.5,
    borderColor: guestColors.surface,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: guestColors.primary,
  },
  avatarText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },

  modalRoot: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(19,33,59,0.45)' },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: guestColors.surface },
  brand: { paddingHorizontal: spacing.lg, fontSize: 20, lineHeight: 28, fontWeight: '700', color: guestColors.primary },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: guestColors.border,
  },
  userName: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.text },
  userRole: { fontSize: 13, lineHeight: 18, color: guestColors.textMuted },
  nav: { flex: 1, padding: spacing.md, gap: spacing.xs },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 11, borderRadius: 10 },
  navItemActive: { backgroundColor: guestColors.primary },
  navText: { fontSize: 15, lineHeight: 20, color: guestColors.text },
  navTextActive: { color: '#ffffff', fontWeight: '500' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: guestColors.border,
  },
  logoutText: { fontSize: 15, lineHeight: 20, color: guestColors.error },
});

export default PatientShell;
