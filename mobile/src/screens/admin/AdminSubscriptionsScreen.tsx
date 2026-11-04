// Subscription Management (web: pages/admin/AdminSubscriptionsPage.jsx): one row per clinic.
import React, { useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { Badge, EmptyState, LoadState, Pager, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { fetchSubscriptions, formatMonthly, NO_PAYMENT, PAYMENT_STATUS, SUBSCRIPTION_STATUS } from '../../services/admin';
import { formatDateTime } from '../../services/clinicPortal';

const Separator = () => <View style={ui.stackItem} />;

const AdminSubscriptionsScreen = () => {
  const navigation = useNavigation<any>();
  const [page, setPage] = useState(1);
  const list = useLoader(() => fetchSubscriptions({ page }), [page], 'Subscriptions could not be loaded.');
  useRefreshOnFocus(list.sync);

  return (
    <AdminScreen title="Subscriptions" active="AdminSubscriptions">
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(row) => String(row.clinic_id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            {list.data ? <Text style={ui.muted}>{list.data.meta.total} clinic subscriptions</Text> : null}
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.data ? <EmptyState icon="card-outline" text="No clinic subscriptions yet." /> : undefined}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        ItemSeparatorComponent={Separator}
        renderItem={({ item: row }) => {
          const status = SUBSCRIPTION_STATUS[row.status] ?? SUBSCRIPTION_STATUS.none;
          const payment = (row.payment_status && PAYMENT_STATUS[row.payment_status]) || NO_PAYMENT;
          return (
            <TouchableOpacity
              style={ui.listItem}
              onPress={() => navigation.navigate('AdminSubscriptionDetail', { clinicId: row.clinic_id })}
              accessibilityRole="button"
              accessibilityLabel={`Open subscription of ${row.clinic_name}`}
            >
              <Text style={ui.title} numberOfLines={1}>{row.clinic_name}</Text>
              <Text style={ui.muted}>
                {row.plan} · {formatMonthly(row.amount)}
              </Text>
              <Text style={ui.small}>Due: {row.due_at ? formatDateTime(row.due_at) : '—'}</Text>
              <View style={ui.rowWrap}>
                <Badge tone={status.tone} label={status.label} />
                <Badge tone={payment.tone} label={payment.label} />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </AdminScreen>
  );
};

export default AdminSubscriptionsScreen;
