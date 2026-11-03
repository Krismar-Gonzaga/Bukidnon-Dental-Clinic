// Clinic portal frame for phones, adapted from the clinic admin web design:
// a top bar with the left-drawer button, page title, notification bell and
// profile dropdown; a global search (patients, branches, staff); the left
// drawer (the web sidebar, filtered by the member's permissions); and a
// bottom tab bar with the main sections and "More".
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useClinicPortal } from './ClinicPortalContext';
import {
  BranchHit,
  CLINIC_ROLE_LABELS,
  PatientHit,
  StaffMember,
  can,
  fetchBranches,
  fetchStaff,
  searchPatients,
} from '../../services/clinicPortal';
import { isNetworkError } from '../../services/api';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';
import OfflineBanner from '../common/OfflineBanner';
import { CLINIC_SETTINGS_SECTION, ClinicRoute, ClinicSection, drawerGroups, TAB_LIMIT, visibleSections } from '../../config/clinicSections';

const initial = (name?: string) => (name ?? '').trim().charAt(0).toUpperCase() || '?';
const DRAWER_WIDTH = Math.min(320, Dimensions.get('window').width * 0.82);

const confirmLogout = (logout: () => void) =>
  Alert.alert('Log out', 'Are you sure you want to log out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: logout },
  ]);

/** Sidebar sections the member's permissions unlock. */
const useSections = () => {
  const { membership } = useClinicPortal();
  return visibleSections(membership);
};

const PUSHED_PAGES: ClinicRoute[] = ['ClinicNotifications', 'ClinicAccount'];

/**
 * Opens a section as the main page. Sections do not stack on each other:
 * Back from any section returns to the dashboard, as the web sidebar does.
 * Notifications and My Profile open on top of the current page.
 */
export const useOpenSection = (active?: ClinicRoute) => {
  const navigation = useNavigation<any>();
  return (route: ClinicRoute, params?: Record<string, unknown>) => {
    if (route === active && !params) return;
    if (PUSHED_PAGES.includes(route)) {
      navigation.navigate(route, params);
    } else if (route === 'ClinicDashboard') {
      navigation.reset({ index: 0, routes: [{ name: route, params }] });
    } else {
      navigation.reset({ index: 1, routes: [{ name: 'ClinicDashboard' }, { name: route, params }] });
    }
  };
};

function DrawerItem({ section, active, onPress }: { section: ClinicSection; active: boolean; onPress: () => void }) {
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

const ACCOUNT_LINKS: ClinicSection[] = [
  { route: 'ClinicNotifications', label: 'Notifications', icon: 'notifications', anyOf: [] },
  { route: 'ClinicAccount', label: 'My Profile', icon: 'person-circle', anyOf: [] },
];

// ---------------------------------------------------------------- Left drawer
function ClinicDrawer({ visible, onClose, active }: { visible: boolean; onClose: () => void; active?: ClinicRoute }) {
  const { user, logout } = useAuth();
  const { memberships, membership, selectClinic } = useClinicPortal();
  const sections = useSections();
  const open = useOpenSection(active);
  const canSettings = can(membership, ...CLINIC_SETTINGS_SECTION.anyOf);
  const isDentist = membership?.role === 'dentist';

  const go = (route: ClinicRoute) => {
    onClose();
    open(route);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerRoot}>
        <SafeAreaView style={styles.drawer} edges={['top', 'bottom', 'left']}>
          <View style={styles.drawerBrand}>
            <Text style={styles.drawerClinic}>{membership?.clinic_name ?? 'Clinic'}</Text>
            <Text style={styles.drawerTagline}>Clinic portal</Text>
          </View>

          {memberships.length > 1 && (
            <View style={styles.drawerSection}>
              <Text style={styles.drawerLabel}>Clinic</Text>
              {memberships.map((m) => (
                <TouchableOpacity
                  key={m.clinic_id}
                  style={[styles.drawerClinicOption, m.clinic_id === membership?.clinic_id && styles.drawerClinicOptionActive]}
                  onPress={() => selectClinic(m.clinic_id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: m.clinic_id === membership?.clinic_id }}
                >
                  <Icon
                    name={m.clinic_id === membership?.clinic_id ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={palette.primary}
                  />
                  <Text style={styles.drawerClinicOptionText} numberOfLines={1}>{m.clinic_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <ScrollView style={styles.drawerNav} accessibilityRole="menu">
            {isDentist ? (
              <>
                {sections.map((s) => (
                  <DrawerItem key={s.route} section={s} active={s.route === active} onPress={() => go(s.route)} />
                ))}
                <View style={styles.drawerDivider} />
                {canSettings && (
                  <DrawerItem section={CLINIC_SETTINGS_SECTION} active={active === CLINIC_SETTINGS_SECTION.route} onPress={() => go(CLINIC_SETTINGS_SECTION.route)} />
                )}
              </>
            ) : (
              <>
                {sections.filter((s) => s.route === 'ClinicDashboard').map((s) => (
                  <DrawerItem key={s.route} section={s} active={s.route === active} onPress={() => go(s.route)} />
                ))}
                {drawerGroups(membership).map((group) => (
                  <View key={group.label}>
                    <Text style={styles.drawerGroup}>{group.label}</Text>
                    {group.sections.map((s) => (
                      <DrawerItem key={s.route} section={s} active={s.route === active} onPress={() => go(s.route)} />
                    ))}
                  </View>
                ))}
              </>
            )}
            {/* Clinic admin design: these are in the top bar and the profile menu instead. */}
            {isDentist && ACCOUNT_LINKS.map((s) => (
              <DrawerItem key={s.route} section={s} active={s.route === active} onPress={() => go(s.route)} />
            ))}
          </ScrollView>

          <View style={styles.drawerFooter}>
            <View style={styles.drawerUser}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial(user?.name)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.drawerUserName} numberOfLines={1}>{user?.name}</Text>
                <Text style={styles.drawerUserRole} numberOfLines={1}>
                  {membership ? CLINIC_ROLE_LABELS[membership.role] : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.drawerLogout}
              onPress={() => {
                onClose();
                confirmLogout(logout);
              }}
              accessibilityRole="button"
            >
              <Icon name="log-out-outline" size={20} color={palette.error} />
              <Text style={styles.drawerLogoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Close menu" accessibilityRole="button" />
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------- Profile dropdown
function ProfileMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const { memberships, membership, selectClinic } = useClinicPortal();
  const others = memberships.filter((m) => m.clinic_id !== membership?.clinic_id);
  const isDentist = membership?.role === 'dentist';
  const openAccount = (tab: 'profile' | 'password') => {
    onClose();
    navigation.navigate('ClinicAccount', { tab });
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.menuScrim} onPress={onClose} accessibilityLabel="Close account menu">
        <SafeAreaView edges={['top']}>
          <Pressable style={styles.menu} onPress={() => undefined}>
            <View style={styles.menuIdentity}>
              <Text style={styles.menuName}>{user?.name}</Text>
              <Text style={styles.menuDetail}>{String(user?.email ?? '')}</Text>
              {membership && (
                <Text style={styles.menuDetail}>
                  {CLINIC_ROLE_LABELS[membership.role]} · {membership.clinic_name}
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.menuItem} onPress={() => openAccount('profile')} accessibilityRole="menuitem">
              <Icon name="person-outline" size={18} color={palette.onSurface} />
              <Text style={styles.menuItemText}>My Profile</Text>
            </TouchableOpacity>
            {!isDentist && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  navigation.navigate('ClinicNotifications');
                }}
                accessibilityRole="menuitem"
              >
                <Icon name="notifications-outline" size={18} color={palette.onSurface} />
                <Text style={styles.menuItemText}>Notifications</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => openAccount('password')} accessibilityRole="menuitem">
              <Icon name={isDentist ? 'key-outline' : 'settings-outline'} size={18} color={palette.onSurface} />
              <Text style={styles.menuItemText}>{isDentist ? 'Change Password' : 'Settings'}</Text>
            </TouchableOpacity>
            {others.map((m) => (
              <TouchableOpacity
                key={m.clinic_id}
                style={styles.menuItem}
                onPress={() => {
                  selectClinic(m.clinic_id);
                  onClose();
                }}
                accessibilityRole="menuitem"
              >
                <Icon name="swap-horizontal-outline" size={18} color={palette.onSurface} />
                <Text style={styles.menuItemText} numberOfLines={1}>Switch to {m.clinic_name}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                onClose();
                confirmLogout(logout);
              }}
              accessibilityRole="menuitem"
            >
              <Icon name="log-out-outline" size={18} color={palette.error} />
              <Text style={[styles.menuItemText, { color: palette.error }]}>Log out</Text>
            </TouchableOpacity>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------- Global search
function GlobalSearch() {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id;
  const canPatients = can(membership, 'patients.view');
  const canStaff = can(membership, 'clinic.staff.manage');
  const canBranches = can(membership, 'clinic.branches.manage', 'clinic.schedules.manage');
  const open = useOpenSection();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<{ patients: PatientHit[]; branches: BranchHit[]; staff: StaffMember[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BranchHit | null>(null);
  const cache = useRef<{ branches?: BranchHit[]; staff?: StaffMember[] }>({});

  useEffect(() => {
    cache.current = {};
  }, [clinicId]);

  useEffect(() => {
    const query = term.trim().toLowerCase();
    if (!clinicId || query.length < 2) {
      setResults(null);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [patients, branches, staff] = await Promise.all([
          canPatients ? searchPatients(clinicId, term.trim()) : Promise.resolve([]),
          cache.current.branches ? Promise.resolve(cache.current.branches) : fetchBranches(clinicId),
          canStaff ? (cache.current.staff ? Promise.resolve(cache.current.staff) : fetchStaff(clinicId)) : Promise.resolve([]),
        ]);
        cache.current = { branches, staff: canStaff ? staff : undefined };
        if (cancelled) return;
        const has = (...values: (string | null | undefined)[]) => values.some((v) => (v ?? '').toLowerCase().includes(query));
        setResults({
          patients: patients.slice(0, 5),
          branches: branches.filter((b) => has(b.name, b.city, b.address)).slice(0, 5),
          staff: staff.filter((m) => has(m.name, m.email)).slice(0, 5),
        });
        setError(null);
      } catch (err) {
        if (!cancelled) setError(isNetworkError(err) ? "You're offline. Search needs a connection." : 'Search failed. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, clinicId, canPatients, canStaff]);

  const clear = () => {
    setTerm('');
    setResults(null);
  };
  const empty = results && results.patients.length + results.branches.length + results.staff.length === 0;

  return (
    <View style={styles.searchWrap}>
      <View style={styles.search}>
        <Icon name="search" size={18} color={palette.onSurfaceVariant} />
        <TextInput
          style={styles.searchInput}
          value={term}
          onChangeText={setTerm}
          placeholder={canPatients ? 'Search patients, branches, or staff…' : 'Search branches or staff…'}
          placeholderTextColor={palette.outline}
          accessibilityLabel="Search patients, branches, or staff"
          autoCapitalize="none"
          returnKeyType="search"
        />
        {term.length > 0 && (
          <TouchableOpacity onPress={clear} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.searchClear}>
            <Icon name="close-circle" size={18} color={palette.outline} />
          </TouchableOpacity>
        )}
      </View>

      {term.trim().length >= 2 && (
        <View style={styles.results} accessibilityLabel="Search results">
          {loading && !results ? (
            <ActivityIndicator color={palette.primary} style={styles.resultsStatus} />
          ) : error ? (
            <Text style={styles.resultsStatusText}>{error}</Text>
          ) : empty ? (
            <Text style={styles.resultsStatusText}>No matches for “{term.trim()}”.</Text>
          ) : results ? (
            <ScrollView style={styles.resultsScroll} keyboardShouldPersistTaps="handled">
              {results.patients.length > 0 && <Text style={styles.resultsGroup}>Patients</Text>}
              {results.patients.map((p) => (
                <ResultRow
                  key={`p${p.id}`}
                  icon="person-outline"
                  title={p.name}
                  detail={[p.phone, p.email].filter(Boolean).join(' · ')}
                  onPress={() => {
                    clear();
                    navigation.navigate('ClinicPatientDetail', { patientId: p.id });
                  }}
                />
              ))}
              {results.branches.length > 0 && <Text style={styles.resultsGroup}>Branches</Text>}
              {results.branches.map((b) => (
                <ResultRow key={`b${b.id}`} icon="business-outline" title={b.name} detail={`${b.address}, ${b.city}`} onPress={() => setDetail(b)} />
              ))}
              {results.staff.length > 0 && <Text style={styles.resultsGroup}>Staff</Text>}
              {results.staff.map((m) => (
                <ResultRow
                  key={`s${m.id}`}
                  icon="id-card-outline"
                  title={m.name}
                  detail={`${CLINIC_ROLE_LABELS[m.role] ?? m.role} · ${m.email}`}
                  onPress={() => {
                    clear();
                    open('ClinicStaff', { search: m.name });
                  }}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>
      )}

      {detail && (
        <Modal transparent animationType="slide" visible onRequestClose={() => setDetail(null)}>
          <Pressable style={styles.sheetScrim} onPress={() => setDetail(null)} accessibilityLabel="Close" />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{detail.name}</Text>
            <Text style={styles.sheetLine}>{detail.address}, {detail.city}</Text>
            {detail.is_main ? <Text style={styles.sheetLine}>Main branch</Text> : null}
            <TouchableOpacity
              style={styles.sheetButton}
              accessibilityRole="button"
              onPress={() => {
                const destination =
                  detail.latitude != null && detail.longitude != null
                    ? `${detail.latitude},${detail.longitude}`
                    : `${membership?.clinic_name ?? ''} ${detail.name}, ${detail.address}, ${detail.city}`;
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`);
              }}
            >
              <Icon name="navigate-outline" size={18} color={palette.onPrimary} />
              <Text style={styles.sheetButtonText}>Directions</Text>
            </TouchableOpacity>
            {canBranches && (
              <TouchableOpacity
                style={styles.sheetOutlineButton}
                accessibilityRole="button"
                onPress={() => {
                  setDetail(null);
                  clear();
                  open('ClinicBranches', { branchId: detail.id });
                }}
              >
                <Text style={styles.sheetCloseText}>Open in Branches & Hours</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.sheetClose} onPress={() => setDetail(null)} accessibilityRole="button">
              <Text style={styles.sheetCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

function ResultRow({ icon, title, detail, onPress }: { icon: string; title: string; detail?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.resultRow} onPress={onPress} accessibilityRole="button">
      <Icon name={icon} size={18} color={palette.primary} />
      <View style={styles.flex}>
        <Text style={styles.resultTitle} numberOfLines={1}>{title}</Text>
        {detail ? <Text style={styles.resultDetail} numberOfLines={1}>{detail}</Text> : null}
      </View>
      <Icon name="chevron-forward" size={16} color={palette.outline} />
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------- Top bar
function Bell() {
  const navigation = useNavigation<any>();
  const { unreadCount, refreshUnread } = useClinicPortal();
  // Re-check the badge whenever a clinic page comes into view.
  useFocusEffect(useCallback(() => refreshUnread(), [refreshUnread]));

  return (
    <TouchableOpacity
      style={styles.iconButton}
      onPress={() => navigation.navigate('ClinicNotifications')}
      accessibilityRole="button"
      accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
    >
      <Icon name="notifications-outline" size={24} color={palette.onSurfaceVariant} />
      {unreadCount > 0 && (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ClinicTopBar({
  title,
  back,
  search,
  onOpenDrawer,
}: {
  title: string;
  back?: boolean;
  search: boolean;
  onOpenDrawer: () => void;
}) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { membership } = useClinicPortal();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <View style={styles.topBar}>
        {back ? (
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="arrow-back" size={24} color={palette.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.iconButton} onPress={onOpenDrawer} accessibilityRole="button" accessibilityLabel="Open menu">
            <Icon name="menu" size={26} color={palette.primary} />
          </TouchableOpacity>
        )}
        <View style={styles.topBarText}>
          <Text style={styles.clinicName} numberOfLines={1}>{membership?.clinic_name ?? 'Clinic'}</Text>
          <Text style={[styles.pageTitle, back && styles.pageTitleSmall]} numberOfLines={1}>{title}</Text>
        </View>
        <Bell />
        {membership?.role !== 'dentist' && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('ClinicAccount', { tab: 'password' })}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Icon name="settings-outline" size={24} color={palette.onSurfaceVariant} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Account menu for ${user?.name ?? 'you'}`}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial(user?.name)}</Text>
          </View>
          <Icon name="chevron-down" size={14} color={palette.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
      {search && <GlobalSearch />}
      <OfflineBanner />
      <ProfileMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

// ---------------------------------------------------------------- Bottom tabs
function ClinicTabBar({ active, onMore }: { active?: ClinicRoute; onMore: () => void }) {
  const open = useOpenSection(active);
  const sections = useSections();
  const tabs = sections.slice(0, TAB_LIMIT);
  const hasMore = sections.length > TAB_LIMIT;
  const moreActive = Boolean(active) && !tabs.some((t) => t.route === active);

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
      {tabs.map((t) => tab(t.route, t.tab ?? t.label, t.icon, t.route === active, () => open(t.route)))}
      {(hasMore || tabs.length < 2) && tab('more', 'More', 'menu', hasMore && moreActive, onMore)}
    </View>
  );
}

// ---------------------------------------------------------------- Page frame
/**
 * Every clinic page: top bar, global search, page body and bottom tabs.
 * Detail pages pass `back` for a back arrow instead of the menu and tabs.
 */
export function ClinicScreen({
  title,
  active,
  back,
  children,
}: {
  title: string;
  active?: ClinicRoute;
  back?: boolean;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <SafeAreaView style={styles.screen} edges={back ? ['top', 'bottom'] : ['top']}>
      <ClinicTopBar title={title} back={back} search={!back} onOpenDrawer={() => setDrawerOpen(true)} />
      <View style={styles.flex}>{children}</View>
      {!back && <ClinicTabBar active={active} onMore={() => setDrawerOpen(true)} />}
      <ClinicDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} active={active} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: palette.surface },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: palette.surface,
  },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  topBarText: { flex: 1 },
  clinicName: { ...type.labelMd, color: palette.onSurfaceVariant, textTransform: 'uppercase' },
  pageTitle: { ...type.headlineMd, color: palette.primary, fontWeight: '700' },
  pageTitleSmall: { ...type.titleLg, fontWeight: '700' },
  bellBadge: { position: 'absolute', top: 6, right: 4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: palette.error, alignItems: 'center', justifyContent: 'center' },
  bellBadgeText: { color: palette.onPrimary, fontSize: 10, fontWeight: '700' },
  avatarButton: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 },
  avatar: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: palette.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.onPrimary, fontWeight: '700', fontSize: 16 },

  // Search
  searchWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.outlineVariant,
    zIndex: 5,
  },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, paddingHorizontal: spacing.md, minHeight: 44, borderRadius: radius.full, backgroundColor: palette.surfaceContainer },
  searchInput: { flex: 1, ...type.bodyMd, color: palette.onSurface, paddingVertical: spacing.base },
  searchClear: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  results: { marginTop: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest, ...shadow.md },
  resultsScroll: { maxHeight: 320 },
  resultsStatus: { padding: spacing.md },
  resultsStatusText: { ...type.bodyMd, color: palette.onSurfaceVariant, padding: spacing.md, textAlign: 'center' },
  resultsGroup: { ...type.labelMd, color: palette.onSurfaceVariant, textTransform: 'uppercase', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, minHeight: 52 },
  resultTitle: { ...type.bodyMd, fontWeight: '600', color: palette.onSurface },
  resultDetail: { fontSize: 12, color: palette.onSurfaceVariant },

  // Detail sheet
  sheetScrim: { flex: 1, backgroundColor: palette.scrim },
  sheet: { padding: spacing.lg, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, backgroundColor: palette.surfaceContainerLowest, gap: spacing.xs },
  sheetTitle: { ...type.titleLg, color: palette.onSurface, marginBottom: spacing.xs },
  sheetLine: { ...type.bodyMd, color: palette.onSurface },
  sheetNote: { fontSize: 12, color: palette.onSurfaceVariant, marginTop: spacing.sm },
  sheetButton: { flexDirection: 'row', gap: spacing.base, marginTop: spacing.md, minHeight: 48, borderRadius: radius.lg, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  sheetButtonText: { color: palette.onPrimary, fontWeight: '600', fontSize: 16 },
  sheetOutlineButton: { marginTop: spacing.sm, minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  sheetClose: { marginTop: spacing.sm, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: { color: palette.primary, fontWeight: '600' },

  // Drawer
  drawerRoot: { flex: 1, flexDirection: 'row', backgroundColor: palette.scrim },
  drawer: { width: DRAWER_WIDTH, backgroundColor: palette.surfaceContainerLow, paddingVertical: spacing.md, ...shadow.lg },
  drawerBrand: { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  drawerClinic: { ...type.headlineMd, fontWeight: '700', color: palette.primary },
  drawerTagline: { ...type.bodyMd, color: palette.onSurfaceVariant, opacity: 0.7 },
  drawerSection: { paddingHorizontal: spacing.md, marginBottom: spacing.md, gap: spacing.xs },
  drawerLabel: { ...type.labelMd, color: palette.onSurfaceVariant, textTransform: 'uppercase' },
  drawerGroup: { ...type.labelMd, marginTop: spacing.md, marginBottom: spacing.xs, paddingHorizontal: spacing.md, color: palette.outline, textTransform: 'uppercase' },
  drawerClinicOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, minHeight: 40, paddingHorizontal: spacing.sm, borderRadius: radius.lg },
  drawerClinicOptionActive: { backgroundColor: palette.primaryFixed },
  drawerClinicOptionText: { ...type.bodyMd, color: palette.onSurface, flex: 1 },
  drawerNav: { flex: 1, paddingHorizontal: spacing.base },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, marginVertical: 2, borderRadius: radius.lg },
  drawerItemActive: { backgroundColor: palette.primaryContainer },
  drawerItemText: { ...type.bodyMd, color: palette.onSurfaceVariant },
  drawerItemTextActive: { color: palette.onPrimary, fontWeight: '600' },
  drawerDivider: { height: 1, backgroundColor: palette.outlineVariant, marginVertical: spacing.sm, marginHorizontal: spacing.md },
  drawerFooter: { borderTopWidth: 1, borderTopColor: palette.outlineVariant, paddingTop: spacing.md, paddingHorizontal: spacing.md, gap: spacing.sm },
  drawerUser: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  drawerUserName: { ...type.labelMd, color: palette.onSurface },
  drawerUserRole: { fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: palette.onSurfaceVariant },
  drawerLogout: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  drawerLogoutText: { ...type.bodyMd, color: palette.error, fontWeight: '600' },

  // Profile dropdown
  menuScrim: { flex: 1, backgroundColor: 'rgba(24,28,32,0.15)' },
  menu: {
    alignSelf: 'flex-end',
    width: 260,
    marginTop: 56,
    marginRight: spacing.sm,
    padding: spacing.base,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceContainerLowest,
    ...shadow.lg,
  },
  menuIdentity: { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.outlineVariant, marginBottom: spacing.xs },
  menuName: { ...type.bodyMd, fontWeight: '700', color: palette.onSurface },
  menuDetail: { fontSize: 12, color: palette.onSurfaceVariant },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radius.lg },
  menuItemText: { ...type.bodyMd, color: palette.onSurface, flex: 1 },
  menuDivider: { height: 1, backgroundColor: palette.outlineVariant, marginVertical: spacing.xs },

  // Bottom tabs
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: palette.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: palette.outlineVariant,
    ...shadow.sm,
  },
  tab: { flex: 1, alignItems: 'center', minHeight: 48 },
  tabIcon: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
  tabIconActive: { backgroundColor: palette.primaryContainer },
  tabLabel: { ...type.labelMd, marginTop: 2, color: palette.onSurfaceVariant },
  tabLabelActive: { color: palette.primary },
});
