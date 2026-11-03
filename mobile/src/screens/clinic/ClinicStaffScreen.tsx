// Staff Directory for phones (clinic admin design, mobile layout): totals,
// search, role filter, staff cards, Manage Account and Add Staff.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { useAuth } from '../../context/AuthContext';
import { isNetworkError } from '../../services/api';
import { CLINIC_ROLE_LABELS, fetchStaff, inviteStaff, Membership, StaffMember, updateStaff } from '../../services/clinicPortal';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';

const ROLES = Object.keys(CLINIC_ROLE_LABELS) as Membership['role'][];
const FILTERS: { id: 'all' | Membership['role']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'dentist', label: 'Dentists' },
  { id: 'staff', label: 'Receptionists' },
  { id: 'inventory_staff', label: 'Inventory' },
  { id: 'clinic_admin', label: 'Admins' },
];
const STATUS_LABELS = { active: 'Active', invited: 'Invited', suspended: 'Suspended' };
const STATUS_COLORS = { active: palette.secondary, invited: '#a16207', suspended: palette.error };

const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
const branchLabel = (m: StaffMember) =>
  m.branches == null ? 'All branches' : m.branches.length > 0 ? m.branches.join(', ') : 'Not scheduled yet';
const serverMessage = (err: any, fallback: string) =>
  isNetworkError(err) ? "You're offline. Try again when you're connected." : err?.response?.data?.message ?? fallback;

function RoleOptions({ value, onChange }: { value: string; onChange: (role: Membership['role']) => void }) {
  return (
    <View style={styles.roleOptions} accessibilityRole="radiogroup">
      {ROLES.map((role) => (
        <TouchableOpacity
          key={role}
          style={[styles.roleOption, value === role && styles.roleOptionActive]}
          onPress={() => onChange(role)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === role }}
        >
          <Icon name={value === role ? 'radio-button-on' : 'radio-button-off'} size={20} color={value === role ? palette.primary : palette.outline} />
          <Text style={styles.roleOptionText}>{CLINIC_ROLE_LABELS[role]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.iconButton}>
              <Icon name="close" size={24} color={palette.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ManageSheet({ member, clinicId, onClose, onSaved }: { member: StaffMember; clinicId: number; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState(member.role);
  const [busy, setBusy] = useState(false);

  const save = async (body: { role?: string; status?: string }) => {
    setBusy(true);
    try {
      await updateStaff(clinicId, member.id, body);
      onSaved();
      onClose();
    } catch (err) {
      Alert.alert('Not saved', serverMessage(err, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleAccess = () => {
    const suspending = member.status === 'active';
    Alert.alert(
      suspending ? 'Suspend access?' : 'Restore access?',
      suspending ? `${member.name} will no longer be able to use this clinic's portal.` : `${member.name} will be able to sign in to this clinic again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: suspending ? 'Suspend' : 'Restore', style: suspending ? 'destructive' : 'default', onPress: () => save({ status: suspending ? 'suspended' : 'active' }) },
      ],
    );
  };

  return (
    <Sheet title={`Manage ${member.name}`} onClose={onClose}>
      <Text style={styles.muted}>{member.email}</Text>
      <Text style={[styles.muted, styles.spacedSm]}>Works at: {branchLabel(member)}</Text>
      <Text style={styles.fieldLabel}>Role</Text>
      <RoleOptions value={role} onChange={setRole} />
      <Text style={styles.hint}>Roles decide what each person can see. Receptionists cannot read clinical records.</Text>
      <TouchableOpacity
        style={[styles.primaryButton, (busy || role === member.role) && styles.disabled]}
        disabled={busy || role === member.role}
        onPress={() => save({ role })}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color={palette.onPrimary} /> : <Text style={styles.primaryButtonText}>Save role</Text>}
      </TouchableOpacity>
      {member.status !== 'invited' && (
        <TouchableOpacity style={styles.outlineButton} disabled={busy} onPress={toggleAccess} accessibilityRole="button">
          <Text style={[styles.outlineButtonText, member.status === 'active' && { color: palette.error }]}>
            {member.status === 'active' ? 'Suspend access' : 'Restore access'}
          </Text>
        </TouchableOpacity>
      )}
    </Sheet>
  );
}

function InviteSheet({ clinicId, defaultRole = 'staff', onClose, onSaved }: { clinicId: number; defaultRole?: Membership['role']; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Membership['role']>(defaultRole);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Check the form', 'Enter a name and a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const message = await inviteStaff(clinicId, { name: name.trim(), email: email.trim(), role });
      onSaved();
      onClose();
      Alert.alert('Staff added', message ?? 'Invitation sent.');
    } catch (err) {
      Alert.alert('Not added', serverMessage(err, 'Please check the details and try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Add staff member" onClose={onClose}>
      <Text style={styles.fieldLabel}>Full name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Juan Dela Cruz" placeholderTextColor={palette.outline} autoComplete="name" />
      <Text style={styles.fieldLabel}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="name@example.com"
        placeholderTextColor={palette.outline}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Text style={styles.fieldLabel}>Role</Text>
      <RoleOptions value={role} onChange={setRole} />
      <Text style={styles.hint}>New people get an email to set their password. Existing accounts must accept the invitation.</Text>
      <TouchableOpacity style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={submit} accessibilityRole="button">
        {busy ? <ActivityIndicator color={palette.onPrimary} /> : <Text style={styles.primaryButtonText}>Add staff</Text>}
      </TouchableOpacity>
    </Sheet>
  );
}

const ClinicStaffScreen = ({ route }: { route?: { params?: { search?: string; inviteRole?: Membership['role'] } } }) => {
  const { user } = useAuth();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id;
  const [members, setMembers] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // The global search opens this screen with a staff member's name.
  const routeSearch = route?.params?.search ?? '';
  const [search, setSearch] = useState(routeSearch);
  useEffect(() => setSearch(routeSearch), [routeSearch]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [managing, setManaging] = useState<StaffMember | null>(null);
  const [inviting, setInviting] = useState(Boolean(route?.params?.inviteRole));

  const load = useCallback(async () => {
    if (!clinicId) return;
    try {
      setMembers(await fetchStaff(clinicId));
      setError(null);
    } catch (err) {
      setError(serverMessage(err, 'Staff could not be loaded.'));
    } finally {
      setRefreshing(false);
    }
  }, [clinicId]);

  useEffect(() => {
    setMembers(null);
    load();
  }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (members ?? []).filter(
      (m) => (filter === 'all' || m.role === filter) && (!term || `${m.name} ${m.email}`.toLowerCase().includes(term)),
    );
  }, [members, search, filter]);

  const all = members ?? [];
  const stats = [
    { label: 'Total staff', value: all.length, icon: 'people', bg: palette.primaryFixed, fg: palette.primary },
    { label: 'Dentists', value: all.filter((m) => m.role === 'dentist').length, icon: 'medkit', bg: palette.secondaryContainer, fg: palette.onSecondaryContainer },
    { label: 'Active', value: all.filter((m) => m.status === 'active').length, icon: 'person', bg: palette.tertiaryFixed, fg: palette.onTertiaryFixedVariant },
    { label: 'On leave today', value: all.filter((m) => m.on_leave_today).length, icon: 'calendar', bg: palette.errorContainer, fg: palette.error },
  ];

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.stats}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
              <Icon name={s.icon} size={20} color={s.fg} />
            </View>
            <View>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.listHeader}>
        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>Personnel List</Text>
          <Text style={styles.muted}>Manage roles and access.</Text>
        </View>
        <TouchableOpacity style={styles.tonalButton} onPress={() => setInviting(true)} accessibilityRole="button">
          <Icon name="person-add-outline" size={18} color={palette.primary} />
          <Text style={styles.tonalButtonText}>Add Staff</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.search}>
        <Icon name="search" size={18} color={palette.outline} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search staff name or email…"
          placeholderTextColor={palette.outline}
          accessibilityLabel="Search staff"
          autoCapitalize="none"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
            onPress={() => setFilter(f.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.id }}
          >
            <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );

  return (
    <ClinicScreen title="Staff Directory" active="ClinicStaff">
      {members === null && !error ? (
        <ActivityIndicator style={styles.loading} size="large" color={palette.primary} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(m) => String(m.id)}
          ListHeaderComponent={header}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[palette.primary]} />}
          ListEmptyComponent={
            <Text style={[styles.muted, styles.empty]}>
              {all.length === 0 ? 'No staff yet. Use Add Staff to invite your team.' : 'No staff match this filter.'}
            </Text>
          }
          renderItem={({ item: m }) => {
            const isMe = m.user_id === user?.id;
            return (
              <View style={styles.member}>
                <View style={styles.memberRow}>
                  <View style={styles.initials}>
                    <Text style={styles.initialsText}>{initials(m.name)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.memberName}>{m.name}</Text>
                    <Text style={styles.muted} numberOfLines={1}>{m.email}</Text>
                  </View>
                  {isMe ? (
                    <Text style={styles.muted}>You</Text>
                  ) : (
                    <TouchableOpacity style={styles.manage} onPress={() => setManaging(m)} accessibilityRole="button" accessibilityLabel={`Manage account for ${m.name}`}>
                      <Text style={styles.manageText}>Manage</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.memberMeta}>
                  <Text style={[styles.roleChip, m.role === 'dentist' && styles.roleChipDentist]}>{CLINIC_ROLE_LABELS[m.role] ?? m.role}</Text>
                  <View style={styles.statusRow}>
                    <View style={[styles.dot, { backgroundColor: STATUS_COLORS[m.status] }]} />
                    <Text style={[styles.statusText, { color: STATUS_COLORS[m.status] }]}>{STATUS_LABELS[m.status] ?? m.status}</Text>
                  </View>
                </View>
                <Text style={styles.branchText}>
                  <Icon name="location-outline" size={13} color={palette.onSurfaceVariant} /> {branchLabel(m)}
                  {m.on_leave_today ? '  ·  On leave today' : ''}
                </Text>
              </View>
            );
          }}
        />
      )}
      {managing && clinicId && <ManageSheet member={managing} clinicId={clinicId} onClose={() => setManaging(null)} onSaved={load} />}
      {inviting && clinicId && <InviteSheet clinicId={clinicId} defaultRole={route?.params?.inviteRole} onClose={() => setInviting(false)} onSaved={load} />}
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.surface },
  flex: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  loading: { marginTop: spacing.xl },
  muted: { ...type.bodyMd, color: palette.onSurfaceVariant },
  spacedSm: { marginTop: spacing.xs },
  empty: { textAlign: 'center', paddingVertical: spacing.lg },
  errorText: { ...type.bodyMd, color: palette.error },
  headerBlock: { gap: spacing.md, marginBottom: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceContainerLowest,
    ...shadow.sm,
  },
  statIcon: { padding: 10, borderRadius: radius.lg },
  statLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: palette.onSurfaceVariant },
  statValue: { ...type.headlineMd, fontWeight: '700', color: palette.onSurface },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...type.titleLg, color: palette.onSurface },
  tonalButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, minHeight: 44, borderRadius: radius.lg, backgroundColor: palette.primaryFixed },
  tonalButtonText: { ...type.labelMd, color: palette.primary },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, paddingHorizontal: spacing.md, minHeight: 44, borderRadius: radius.full, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLow },
  searchInput: { flex: 1, ...type.bodyMd, color: palette.onSurface, paddingVertical: spacing.base },
  filters: { gap: spacing.base },
  filterChip: { paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center', borderRadius: radius.lg, backgroundColor: palette.surfaceContainerHigh },
  filterChipActive: { backgroundColor: palette.surfaceContainerLowest, ...shadow.sm },
  filterText: { ...type.labelMd, color: palette.onSurfaceVariant },
  filterTextActive: { color: palette.onSurface },
  member: { padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest, gap: spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  initials: { width: 40, height: 40, borderRadius: radius.lg, backgroundColor: palette.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontWeight: '700', color: palette.primary },
  memberName: { ...type.bodyLg, fontWeight: '600', color: palette.onSurface },
  manage: { paddingHorizontal: spacing.sm, minHeight: 40, justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: palette.primaryFixedDim },
  manageText: { ...type.labelMd, color: palette.primary },
  memberMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roleChip: { overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(215,226,255,0.6)', color: palette.primary, fontSize: 12, fontWeight: '600' },
  roleChipDentist: { backgroundColor: 'rgba(103,252,198,0.35)', color: palette.onSecondaryContainer },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  branchText: { fontSize: 12, color: palette.onSurfaceVariant },
  scrim: { flex: 1, backgroundColor: palette.scrim },
  sheet: { maxHeight: '85%', padding: spacing.lg, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, backgroundColor: palette.surfaceContainerLowest },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  sheetTitle: { ...type.titleLg, color: palette.onSurface, flex: 1 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { ...type.labelMd, color: palette.onSurface, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.outlineVariant, ...type.bodyLg, color: palette.onSurface },
  roleOptions: { gap: spacing.xs },
  roleOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radius.lg },
  roleOptionActive: { backgroundColor: palette.primaryFixed },
  roleOptionText: { ...type.bodyMd, color: palette.onSurface },
  hint: { fontSize: 12, color: palette.onSurfaceVariant, marginTop: spacing.sm },
  primaryButton: { marginTop: spacing.lg, minHeight: 48, borderRadius: radius.lg, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: palette.onPrimary, fontWeight: '600', fontSize: 16 },
  outlineButton: { marginTop: spacing.sm, minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  outlineButtonText: { color: palette.primary, fontWeight: '600', fontSize: 16 },
  disabled: { opacity: 0.5 },
});

export default ClinicStaffScreen;
