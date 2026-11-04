// Clinic Management (web: pages/admin/AdminClinicsPage.jsx): every clinic, and the
// registrations still on their way to becoming one. No access to patients or records.
import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { Badge, Button, Chips, EmptyState, LoadState, Pager, SearchBox, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { CLINIC_STATUS, CLINIC_STATUS_FILTERS, DirectoryRow, fetchClinicDirectory } from '../../services/admin';
import { DecisionSheet } from './AdminApplicationDetailScreen';

const Separator = () => <View style={ui.stackItem} />;
const OPEN = ['pending', 'under_review'];

function useDebounced(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const AdminClinicsScreen = () => {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [approving, setApproving] = useState<DirectoryRow | null>(null);
  const term = useDebounced(search.trim());
  const list = useLoader(
    () => fetchClinicDirectory({ search: term || undefined, status: status || undefined, page }),
    [term, status, page],
    'Clinics could not be loaded.',
  );
  useRefreshOnFocus(list.sync);

  const openRow = (row: DirectoryRow) =>
    row.kind === 'clinic' ? navigation.navigate('AdminClinicDetail', { clinicId: row.id }) : navigation.navigate('AdminApplicationDetail', { applicationId: row.id });

  return (
    <AdminScreen title="Clinic Management" active="AdminClinics">
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(row) => `${row.kind}-${row.id}`}
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            {list.data ? <Text style={ui.muted}>{list.data.meta.total} registered clinics</Text> : null}
            <SearchBox value={search} onChangeText={(text) => { setSearch(text); setPage(1); }} placeholder="Search clinics..." />
            <Chips options={CLINIC_STATUS_FILTERS} value={status} onChange={(next) => { setStatus(next); setPage(1); }} />
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.data ? <EmptyState icon="business-outline" text="No clinics match these filters." /> : undefined}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        ItemSeparatorComponent={Separator}
        renderItem={({ item: row }) => {
          const badge = CLINIC_STATUS[row.status] ?? CLINIC_STATUS.pending;
          return (
            <View style={ui.listItem}>
              <TouchableOpacity onPress={() => openRow(row)} accessibilityRole="button" accessibilityLabel={`Open ${row.name}`}>
                <View style={ui.between}>
                  <Text style={[ui.title, ui.flex]} numberOfLines={1}>{row.name}</Text>
                  <Badge tone={badge.tone} label={badge.label} />
                </View>
                <Text style={ui.muted}>{[row.city, row.admin && `Admin: ${row.admin}`, row.plan && `Plan: ${row.plan}`].filter(Boolean).join(' · ')}</Text>
              </TouchableOpacity>
              {row.kind === 'application' && OPEN.includes(row.status) && (
                <View style={ui.rowWrap}>
                  <Button small variant="tonal" label="Approve" disabled={(row.missing_documents ?? 0) > 0} onPress={() => setApproving(row)} />
                </View>
              )}
            </View>
          );
        }}
      />
      {approving && (
        <DecisionSheet
          app={{ id: approving.id, clinic_name: approving.name }}
          kind="approve"
          onClose={() => setApproving(null)}
          onDone={() => {
            setApproving(null);
            list.sync();
          }}
        />
      )}
    </AdminScreen>
  );
};

export default AdminClinicsScreen;
