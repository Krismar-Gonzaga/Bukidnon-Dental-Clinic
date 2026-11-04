// System administrator frame for phones (web: layouts/AdminLayout.jsx):
// top bar (menu or back, title, notifications, account), left drawer with
// every admin section and the live system status, and bottom tabs.
import React, { useCallback, useState } from 'react';
import { Alert, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useLoader } from '../clinic/ClinicUi';
import { ADMIN_SECTIONS, ADMIN_TABS, AdminRoute, AdminSection } from '../../config/adminSections';
import { fetchSystemHealth } from '../../services/admin';
import { fetchUnreadCount } from '../../services/notifications';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';

const LONG_TITLE = 14;
const DRAWER_WIDTH = Math.min(320, Dimensions.get('window').width * 0.82);
const initial = (name?: string) => (name ?? '').trim().charAt(0).toUpperCase() || '?';
const HEALTH = {
  healthy: { label: 'Healthy', color: palette.secondary },
  degraded: { label: 'Needs attention', color: '#b7791f' },
  down: { label: 'Service down', color: palette.error },
};

const PUSHED: AdminRoute[] = ['AdminApplicationDetail', 'AdminClinicDetail', 'AdminSubscriptionDetail', 'AdminAnnouncementForm', 'AdminNotifications', 'AdminAccount'];

/** Sections replace each other (Back returns to the dashboard); detail pages stack. */
export const useOpenAdmin = (active?: AdminRoute) => {
  const navigation = useNavigation<any>();
  return (route: AdminRoute, params?: Record<string, unknown>) => {
    if (route === active && !params) return;
    if (PUSHED.includes(route)) navigation.navigate(route, params);
    else if (route === 'AdminDashboard') navigation.reset({ index: 0, routes: [{ name: route, params }] });
    else navigation.reset({ index: 1, routes: [{ name: 'AdminDashboard' }, { name: route, params }] });
  };
};

const confirmLogout = (logout: () => void) =>
  Alert.alert('Log out', 'Are you sure you want to log out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: logout },
  ]);

function SystemStatus({ onOpen }: { onOpen: () => void }) {
  const health = useLoader(fetchSystemHealth, [], 'Unavailable');
  const meta = health.data ? HEALTH[health.data.status] : null;
  return (
    <View style={styles.status}>
      <View style={styles.statusLine} accessible accessibilityLabel={`System status: ${meta?.label ?? (health.loading ? 'checking' : 'unavailable')}`}>
        <View style={[styles.statusDot, { backgroundColor: meta?.color ?? palette.outlineVariant }]} />
        <Text style={styles.statusText}>System Status: {meta?.label ?? (health.loading ? 'Checking…' : 'Unavailable')}</Text>
      </View>
      <TouchableOpacity style={styles.statusButton} onPress={onOpen} accessibilityRole="button">
        <Text style={styles.statusButtonText}>View Health Logs</Text>
      </TouchableOpacity>
    </View>
  );
}

function DrawerItem({ section, active, onPress }: { section: AdminSection; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.drawerItem, active && styles.drawerItemActive]}
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityState={{ selected: active }}
    >
      <Icon name={active ? section.icon : `${section.icon}-outline`} size={22} color={active ? palette.onPrimary : palette.onSurfaceVariant} />
      <Text style={[styles.drawerItemText, active && styles.drawerItemTextActive]}>{section.label}</Text>
    </TouchableOpacity>
  );
}

function AdminDrawer({ visible, onClose, active }: { visible: boolean; onClose: () => void; active?: AdminRoute }) {
  const { user, logout } = useAuth();
  const open = useOpenAdmin(active);
  const go = (route: AdminRoute) => {
    onClose();
    open(route);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerRoot}>
        <SafeAreaView style={styles.drawer} edges={['top', 'bottom', 'left']}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Icon name="medkit" size={22} color="#bbd0ff" />
            </View>
            <View>
              <Text style={styles.brandName}>Admin Portal</Text>
              <Text style={styles.brandRole}>System Administrator</Text>
            </View>
          </View>
          <ScrollView style={styles.drawerNav} accessibilityRole="menu">
            {ADMIN_SECTIONS.map((s) => (
              <DrawerItem key={s.route} section={s} active={s.route === active} onPress={() => go(s.route)} />
            ))}
            <View style={styles.divider} />
            <DrawerItem section={{ route: 'AdminNotifications', label: 'Notifications', icon: 'notifications' }} active={active === 'AdminNotifications'} onPress={() => go('AdminNotifications')} />
            <DrawerItem section={{ route: 'AdminAccount', label: 'My Profile', icon: 'person-circle' }} active={active === 'AdminAccount'} onPress={() => go('AdminAccount')} />
            <SystemStatus onOpen={() => go('AdminSettings')} />
          </ScrollView>
          <View style={styles.drawerFooter}>
            <View style={styles.drawerUser}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial(user?.name)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.drawerUserName} numberOfLines={1}>{user?.name}</Text>
                <Text style={styles.drawerUserRole}>System Administrator</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.logout}
              onPress={() => {
                onClose();
                confirmLogout(logout);
              }}
              accessibilityRole="button"
            >
              <Icon name="log-out-outline" size={20} color={palette.error} />
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Close menu" accessibilityRole="button" />
      </View>
    </Modal>
  );
}

function Bell() {
  const navigation = useNavigation<any>();
  const [count, setCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount().then(setCount).catch(() => undefined);
    }, []),
  );
  return (
    <TouchableOpacity
      style={styles.iconButton}
      onPress={() => navigation.navigate('AdminNotifications')}
      accessibilityRole="button"
      accessibilityLabel={count ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <Icon name="notifications-outline" size={24} color={palette.onSurfaceVariant} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function AdminTabBar({ active, onMore }: { active?: AdminRoute; onMore: () => void }) {
  const open = useOpenAdmin(active);
  const moreActive = Boolean(active) && !ADMIN_TABS.some((t) => t.route === active);
  const tab = (key: string, label: string, icon: string, isActive: boolean, onPress: () => void) => (
    <TouchableOpacity key={key} style={styles.tab} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: isActive }}>
      <View style={[styles.tabIcon, isActive && styles.tabIconActive]}>
        <Icon name={isActive ? icon : `${icon}-outline`} size={22} color={isActive ? palette.onPrimary : palette.onSurfaceVariant} />
      </View>
      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.tabBar}>
      {ADMIN_TABS.map((t) => tab(t.route, t.tab ?? t.label, t.icon, t.route === active, () => open(t.route)))}
      {tab('more', 'More', 'menu', moreActive, onMore)}
    </View>
  );
}

/** Every admin page: top bar, body and bottom tabs; detail pages pass `back`. */
export function AdminScreen({ title, active, back, children }: { title: string; active?: AdminRoute; back?: boolean; children: React.ReactNode }) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={back ? ['top', 'bottom'] : ['top']}>
      <View style={styles.topBar}>
        {back ? (
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="arrow-back" size={24} color={palette.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.iconButton} onPress={() => setDrawerOpen(true)} accessibilityRole="button" accessibilityLabel="Open menu">
            <Icon name="menu" size={26} color={palette.primary} />
          </TouchableOpacity>
        )}
        <View style={styles.flex}>
          <Text style={styles.product}>BukidnonDental Admin</Text>
          <Text style={[styles.title, (back || title.length > LONG_TITLE) && styles.titleSmall]} numberOfLines={1} accessibilityRole="header">{title}</Text>
        </View>
        <Bell />
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('AdminAccount')}
          accessibilityRole="button"
          accessibilityLabel={`My profile, ${user?.name ?? ''}`}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial(user?.name)}</Text>
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.flex}>{children}</View>
      {!back && <AdminTabBar active={active} onMore={() => setDrawerOpen(true)} />}
      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} active={active} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: palette.surface },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: palette.surfaceContainerLowest, borderBottomWidth: 1, borderBottomColor: palette.outlineVariant },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  product: { ...type.labelMd, color: palette.onSurfaceVariant, textTransform: 'uppercase' },
  title: { ...type.headlineMd, color: palette.primary, fontWeight: '700' },
  titleSmall: { ...type.titleLg, fontWeight: '700' },
  badge: { position: 'absolute', top: 6, right: 4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: palette.error, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: palette.onPrimary, fontSize: 10, fontWeight: '700' },
  avatar: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: palette.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.onPrimary, fontWeight: '700', fontSize: 15 },

  drawerRoot: { flex: 1, flexDirection: 'row', backgroundColor: palette.scrim },
  drawer: { width: DRAWER_WIDTH, backgroundColor: palette.surfaceContainerLow, paddingVertical: spacing.md, ...shadow.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  brandMark: { width: 40, height: 40, borderRadius: radius.lg, backgroundColor: palette.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  brandName: { ...type.titleLg, color: palette.onSurface },
  brandRole: { ...type.labelMd, color: palette.onSurfaceVariant, opacity: 0.7 },
  drawerNav: { flex: 1, paddingHorizontal: spacing.base },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, marginVertical: 2, borderRadius: radius.lg },
  drawerItemActive: { backgroundColor: palette.primaryContainer },
  drawerItemText: { ...type.bodyMd, color: palette.onSurfaceVariant },
  drawerItemTextActive: { color: palette.onPrimary, fontWeight: '700' },
  divider: { height: 1, backgroundColor: palette.outlineVariant, marginVertical: spacing.sm, marginHorizontal: spacing.md },
  status: { margin: spacing.sm, padding: spacing.md, borderRadius: radius.xl, backgroundColor: palette.surfaceContainerHigh, gap: spacing.sm },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...type.labelMd, color: palette.onSecondaryContainer, flexShrink: 1 },
  statusButton: { minHeight: 40, borderRadius: radius.lg, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  statusButtonText: { ...type.labelMd, color: palette.onPrimary },
  drawerFooter: { borderTopWidth: 1, borderTopColor: palette.outlineVariant, paddingTop: spacing.md, paddingHorizontal: spacing.md, gap: spacing.sm },
  drawerUser: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  drawerUserName: { ...type.labelMd, color: palette.onSurface },
  drawerUserRole: { fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: palette.onSurfaceVariant },
  logout: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  logoutText: { ...type.bodyMd, color: palette.error, fontWeight: '600' },

  tabBar: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: spacing.base, paddingBottom: spacing.sm, backgroundColor: palette.surfaceContainerLow, borderTopWidth: 1, borderTopColor: palette.outlineVariant, ...shadow.sm },
  tab: { flex: 1, alignItems: 'center', minHeight: 48 },
  tabIcon: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
  tabIconActive: { backgroundColor: palette.primaryContainer },
  tabLabel: { ...type.labelMd, marginTop: 2, color: palette.onSurfaceVariant },
  tabLabelActive: { color: palette.primary },
});
