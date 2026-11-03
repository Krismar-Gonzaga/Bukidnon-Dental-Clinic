// Clinic registration queue (web: pages/admin/AdminApplicationsPage.jsx).
import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { Badge, Chips, EmptyState, LoadState, Pager, SearchBox, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { APPLICATION_STATUS_LABELS, fetchApplications } from '../../services/admin';
import { formatDateTime } from '../../services/clinicPortal';

const Separator = () => <View style={ui.stackItem} />;

const STATUSES = [
  { id: 'pending', label: 'Pending' },
  { id: 'under_review', label: 'Reviewing' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Returned' },
  { id: '', label: 'All' },
];
const TONES: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = { pending: 'warning', under_review: 'info', approved: 'success', rejected: 'neutral' };

function useDebounced(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const AdminApplicationsScreen = () => {
  const navigation = useNavigation<any>();
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounced(search.trim());
  const list = useLoader(
    () => fetchApplications({ status: status || undefined, search: term || undefined, page }),
    [status, term, page],
    'The queue could not be loaded.',
  );
  useRefreshOnFocus(list.sync);

  return (
    <AdminScreen title="Registration Queue" active="AdminApplications">
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            <Text style={ui.muted}>Oldest submissions first. Drafts stay private to the applicant.</Text>
            <SearchBox value={search} onChangeText={(t) => { setSearch(t); setPage(1); }} placeholder="Search clinic name or city" />
            <Chips options={STATUSES} value={status} onChange={(s) => { setStatus(s); setPage(1); }} />
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.data ? <EmptyState icon="file-tray-outline" text="No registrations in this list." /> : undefined}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        ItemSeparatorComponent={Separator}
        renderItem={({ item: a }) => (
          <TouchableOpacity
            style={ui.listItem}
            onPress={() => navigation.navigate('AdminApplicationDetail', { applicationId: a.id })}
            accessibilityRole="button"
            accessibilityLabel={`Review ${a.clinic_name}`}
          >
            <View style={ui.between}>
              <Text style={[ui.title, ui.flex]} numberOfLines={1}>{a.clinic_name}</Text>
              <Badge tone={TONES[a.status]} label={APPLICATION_STATUS_LABELS[a.status] ?? a.status} />
            </View>
            <Text style={ui.muted}>{[a.city, a.province].filter(Boolean).join(', ') || '—'}</Text>
            <Text style={ui.small}>
              {a.applicant?.name ? `${a.applicant.name} · ` : ''}
              {a.submitted_at ? `Submitted ${formatDateTime(a.submitted_at)}` : 'Not submitted'}
            </Text>
          </TouchableOpacity>
        )}
      />
    </AdminScreen>
  );
};

export default AdminApplicationsScreen;
