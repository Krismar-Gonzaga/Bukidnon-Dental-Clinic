// Account management (web: pages/admin/AdminUsersPage.jsx). Suspending signs
// the person out everywhere. Changes are summarised and confirmed, then need
// the password (423). Administrators cannot change their own account here.
import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { actionError, PasswordPrompt, useSensitiveAction } from '../../components/admin/AdminSecurity';
import { Badge, Button, Chips, EmptyState, Field, FormError, LoadState, Pager, SearchBox, SelectField, Sheet, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { useAuth } from '../../context/AuthContext';
import { AdminUser, describeUserChange, fetchUsers, formatMonthYear, updateUser, USER_ROLE_LABELS, UserRole } from '../../services/admin';

const Separator = () => <View style={ui.stackItem} />;

const ROLE_OPTIONS = (Object.keys(USER_ROLE_LABELS) as UserRole[]).map((id) => ({ id, label: USER_ROLE_LABELS[id] }));
const STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'suspended', label: 'Suspended' },
];

function useDebounced(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function ManageSheet({ user, status, onClose, onDone }: { user: AdminUser; status?: string; onClose: () => void; onDone: () => void }) {
  const sensitive = useSensitiveAction();
  const [form, setForm] = useState({ role: user.role, status: status ?? (user.status as string), reason: '' });
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = form.role !== user.role || form.status !== user.status;
  const needsReason = form.status === 'suspended' && user.status !== 'suspended';

  const save = async () => {
    setBusy(true);
    setError(null);
    const body: { role?: UserRole; status?: string; reason?: string } = {};
    if (form.role !== user.role) body.role = form.role;
    if (form.status !== user.status) {
      body.status = form.status;
      body.reason = form.reason.trim() || undefined;
    }
    try {
      await sensitive.run(() => updateUser(user.id, body));
      onDone();
    } catch (err) {
      setError(actionError(err, 'The account could not be updated.'));
      setBusy(false);
    }
  };

  return (
    <Sheet title={`Manage ${user.name}`} onClose={busy ? () => undefined : onClose}>
      {!reviewing ? (
        <>
          <SelectField label="Account type" options={ROLE_OPTIONS} value={form.role} onChange={(role) => setForm((f) => ({ ...f, role }))} />
          <Text style={ui.small}>Changing to System Admin grants platform administration.</Text>
          <Text style={[ui.small, ui.spacedTop]}>Status</Text>
          <Chips options={STATUS_FILTERS.slice(1)} value={form.status} onChange={(next) => setForm((f) => ({ ...f, status: next }))} scroll={false} />
          {needsReason && (
            <Field label="Reason (recorded in the audit log)" required multiline maxLength={500} value={form.reason} onChangeText={(reason) => setForm((f) => ({ ...f, reason }))} />
          )}
          <Button label="Review change" style={ui.spacedTop} disabled={!changed || (needsReason && !form.reason.trim())} onPress={() => setReviewing(true)} />
        </>
      ) : (
        <>
          <Text style={ui.title}>Please confirm:</Text>
          {describeUserChange(user, form as { role: UserRole; status: string }).map((line) => (
            <Text key={line} style={ui.muted}>• {line}</Text>
          ))}
          <FormError message={error} />
          <PasswordPrompt sensitive={sensitive} inline />
          {!sensitive.asking && (
            <View style={[ui.rowWrap, ui.spacedTop]}>
              <Button small variant="outline" label="Back" disabled={busy} onPress={() => setReviewing(false)} />
              <Button small variant={form.status === 'suspended' && needsReason ? 'danger' : 'primary'} label="Confirm change" busy={busy} onPress={save} />
            </View>
          )}
        </>
      )}
    </Sheet>
  );
}

const AdminUsersScreen = ({ route }: { route?: { params?: { search?: string; status?: string } } }) => {
  const { user: me } = useAuth();
  const [search, setSearch] = useState(route?.params?.search ?? '');
  const [status, setStatus] = useState(route?.params?.status ?? '');
  const [role, setRole] = useState<string>('');
  const [page, setPage] = useState(1);
  const [managing, setManaging] = useState<{ user: AdminUser; status?: string } | null>(null);
  const term = useDebounced(search.trim());
  const list = useLoader(
    () => fetchUsers({ search: term || undefined, status: status || undefined, role: role || undefined, page }),
    [term, status, role, page],
    'Accounts could not be loaded.',
  );
  useRefreshOnFocus(list.sync);
  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <AdminScreen title="User Management" active="AdminUsers">
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(u) => String(u.id)}
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            <SearchBox value={search} onChangeText={reset(setSearch)} placeholder="Search name or email" />
            <Chips options={STATUS_FILTERS} value={status} onChange={reset(setStatus)} />
            <Chips options={[{ id: '', label: 'All types' }, ...ROLE_OPTIONS]} value={role} onChange={reset(setRole)} />
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.data ? <EmptyState icon="people-outline" text="No accounts match." /> : undefined}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        ItemSeparatorComponent={Separator}
        renderItem={({ item: u }) => {
          const isMe = u.id === me?.id;
          return (
            <View style={ui.listItem}>
              <TouchableOpacity
                disabled={isMe}
                onPress={() => setManaging({ user: u })}
                accessibilityRole="button"
                accessibilityLabel={isMe ? `${u.name} (you)` : `Change account type of ${u.name}`}
              >
              <View style={ui.between}>
                <Text style={[ui.title, ui.flex]} numberOfLines={1}>
                  {u.name}
                  {isMe ? ' (you)' : ''}
                </Text>
                <Badge tone={u.status === 'active' ? 'success' : 'warning'} label={u.status === 'active' ? 'Active' : 'Suspended'} />
              </View>
              <Text style={ui.muted} numberOfLines={1}>{u.email}</Text>
              <Text style={ui.small}>
                {[USER_ROLE_LABELS[u.role] ?? u.role, u.clinic_name, `joined ${formatMonthYear(u.created_at)}`].filter(Boolean).join(' · ')}
              </Text>
              </TouchableOpacity>
              {!isMe && (
                <View style={ui.rowWrap}>
                  <Button
                    small
                    variant={u.status === 'active' ? 'danger' : 'tonal'}
                    label={u.status === 'active' ? 'Suspend' : 'Reactivate'}
                    onPress={() => setManaging({ user: u, status: u.status === 'active' ? 'suspended' : 'active' })}
                  />
                </View>
              )}
            </View>
          );
        }}
      />
      {managing && (
        <ManageSheet
          user={managing.user}
          status={managing.status}
          onClose={() => setManaging(null)}
          onDone={() => {
            setManaging(null);
            list.sync();
          }}
        />
      )}
    </AdminScreen>
  );
};

export default AdminUsersScreen;
