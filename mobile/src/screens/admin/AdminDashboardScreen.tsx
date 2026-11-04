// Platform overview for phones (web: pages/admin/AdminDashboardPage.jsx).
// Aggregates only: no patient-level data.
import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { AdminScreen, useOpenAdmin } from '../../components/admin/AdminChrome';
import { MiniBars } from '../../components/admin/AdminWidgets';
import { Card, EmptyState, LoadState, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { useAuth } from '../../context/AuthContext';
import { fetchAdminDashboard } from '../../services/admin';
import { formatCount, formatDateTime } from '../../services/clinicPortal';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';

const BREAKDOWN = [
  { role: 'patient', label: 'Patients' },
  { role: 'dentist', label: 'Dentists' },
  { role: 'staff', label: 'Clinic Staff' },
  { role: 'clinic_admin', label: 'Clinic Admins' },
  { role: 'system_admin', label: 'System Admins' },
];
const OUTCOME_COLORS: Record<string, string> = { success: palette.secondary, pending: '#b7791f', failed: palette.error, blocked: palette.error };

function Tile({ icon, value, label, note }: { icon: string; value: string; label: string; note: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}, ${note}`}>
      <View style={styles.tileIcon}>
        <Icon name={icon} size={20} color={palette.primary} />
      </View>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={ui.small}>{note}</Text>
    </View>
  );
}

const AdminDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const open = useOpenAdmin('AdminDashboard');
  const dashboard = useLoader(fetchAdminDashboard, [], 'The overview could not be loaded.');
  useRefreshOnFocus(dashboard.sync);
  const data = dashboard.data;
  const waiting = data ? data.applications.pending + data.applications.under_review : 0;
  const totalUsers = data ? Object.values(data.users).reduce((sum, value) => sum + Number(value), 0) : 0;

  return (
    <AdminScreen title="System Dashboard" active="AdminDashboard">
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={dashboard.refreshing} onRefresh={dashboard.refresh} colors={[palette.primary]} />}>
        {!data ? (
          <LoadState loading={dashboard.loading} error={dashboard.error} onRetry={dashboard.reload} />
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroGreeting}>Welcome back,</Text>
              <Text style={styles.heroName}>{user?.name}</Text>
              <Text style={styles.heroText}>
                {formatCount(waiting)} clinic(s) pending verification. {formatCount(data.pending_payments.total)} payment(s) awaiting review.
              </Text>
              <View style={styles.heroActions}>
                <TouchableOpacity style={[styles.heroButton, styles.heroButtonSolid]} onPress={() => open('AdminApplications')} accessibilityRole="button">
                  <Icon name="shield-outline" size={16} color={palette.primary} />
                  <Text style={styles.heroButtonSolidText}>Review Verifications</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.heroButton} onPress={() => open('AdminSubscriptions')} accessibilityRole="button">
                  <Icon name="card-outline" size={16} color={palette.onPrimary} />
                  <Text style={styles.heroButtonText}>Payment Review</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.tiles}>
              <Tile icon="business-outline" value={formatCount(data.clinics.total)} label="Total Clinics" note={`${formatCount(data.clinics.verified)} verified`} />
              <Tile icon="shield-outline" value={formatCount(waiting)} label="Pending Verification" note="Awaiting review" />
              <Tile icon="people-outline" value={formatCount(totalUsers)} label="Total Users" note="All roles" />
              <Tile icon="card-outline" value={formatCount(data.pending_payments.total)} label="Pending Payments" note="Proof submitted" />
              <Tile icon="checkmark-circle-outline" value={formatCount(data.active_subscriptions)} label="Active Subscriptions" note="Across all clinics" />
              <Tile icon="calendar-outline" value={formatCount(data.total_appointments)} label="Total Appointments" note="Platform-wide" />
              <Tile icon="alert-circle-outline" value={formatCount(data.clinics.suspended)} label="Suspended Clinics" note="Inactive" />
              <Tile icon="notifications-outline" value={formatCount(data.active_announcements)} label="System Announcements" note="Active" />
            </View>

            <Card title="Pending Actions">
              {data.queue.length === 0 && data.pending_payments.items.length === 0 ? <EmptyState icon="checkmark-done-outline" text="Nothing is waiting for you." /> : null}
              {data.queue.map((item) => (
                <View key={`a${item.id}`} style={[styles.pending, styles.pendingVerification]}>
                  <Text style={ui.title}>{item.clinic_name}</Text>
                  <Text style={ui.small}>Verification · {item.submitted_at ? formatDateTime(item.submitted_at) : 'Not dated'}</Text>
                  <TouchableOpacity style={[styles.pendingButton, styles.pendingButtonVerification]} onPress={() => navigation.navigate('AdminApplicationDetail', { applicationId: item.id })} accessibilityRole="button" accessibilityLabel={`Review ${item.clinic_name}`}>
                    <Text style={styles.pendingButtonVerificationText}>Review Now</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {data.pending_payments.items.map((item) => (
                <View key={`p${item.id}`} style={[styles.pending, styles.pendingPayment]}>
                  <Text style={ui.title}>{item.clinic_name}</Text>
                  <Text style={ui.small}>Payment Proof Submitted</Text>
                  <TouchableOpacity style={[styles.pendingButton, styles.pendingButtonPayment]} onPress={() => navigation.navigate('AdminSubscriptionDetail', { clinicId: item.clinic_id })} accessibilityRole="button" accessibilityLabel={`Verify payment from ${item.clinic_name}`}>
                    <Text style={styles.pendingButtonPaymentText}>Verify Payment</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </Card>

            <Card title="Platform Growth" subtitle="Accounts at the end of each month">
              <MiniBars label="Accounts per month" rows={data.platform_growth.map((point) => ({ key: point.month, label: point.label, value: point.total }))} />
            </Card>

            <Card title="Recent Audit Activity" action={<Text style={styles.link} onPress={() => open('AdminAuditLog')} accessibilityRole="link">View all logs</Text>}>
              {data.recent_audit.length === 0 ? <Text style={ui.muted}>No activity yet.</Text> : null}
              {data.recent_audit.map((item) => (
                <View key={item.id} style={styles.auditRow}>
                  <View style={[styles.auditDot, { backgroundColor: OUTCOME_COLORS[item.outcome] ?? palette.secondary }]} />
                  <View style={ui.flex}>
                    <Text style={styles.auditTitle}>{[item.label, item.subject_label].filter(Boolean).join(' — ')}</Text>
                    <Text style={ui.small}>{[item.user_name, item.module, formatDateTime(item.created_at)].filter(Boolean).join(' · ')}</Text>
                  </View>
                </View>
              ))}
            </Card>

            <Card title="User Breakdown">
              {BREAKDOWN.map(({ role, label }) => (
                <View key={role} style={styles.breakdown}>
                  <Text style={ui.muted}>{label}</Text>
                  <Text style={styles.breakdownCount}>{formatCount(data.users[role] ?? 0)}</Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  hero: { padding: spacing.md, borderRadius: radius.xxl, backgroundColor: palette.primary, gap: spacing.xs },
  heroGreeting: { ...type.bodyMd, color: palette.onPrimary, opacity: 0.85 },
  heroName: { ...type.headlineLgMobile, color: palette.onPrimary },
  heroText: { ...type.bodyMd, color: palette.onPrimary },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  heroButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.18)' },
  heroButtonSolid: { backgroundColor: palette.surfaceContainerLowest },
  heroButtonText: { fontSize: 13, fontWeight: '600', color: palette.onPrimary },
  heroButtonSolidText: { fontSize: 13, fontWeight: '600', color: palette.primary },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1, padding: spacing.md, borderRadius: radius.xxl, backgroundColor: palette.surfaceContainerLowest, ...shadow.sm },
  tileIcon: { width: 36, height: 36, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryFixed },
  tileValue: { ...type.headlineLgMobile, color: palette.onSurface, marginTop: spacing.xs },
  tileLabel: { fontSize: 13, fontWeight: '600', color: palette.onSurface },
  pending: { gap: 2, padding: spacing.sm, marginTop: spacing.sm, borderWidth: 1, borderRadius: radius.lg },
  pendingVerification: { borderColor: '#f3dc8c', backgroundColor: '#fffbeb' },
  pendingPayment: { borderColor: palette.primaryFixedDim, backgroundColor: palette.primaryFixed },
  pendingButton: { alignItems: 'center', paddingVertical: spacing.xs, marginTop: spacing.xs, borderRadius: radius.sm },
  pendingButtonVerification: { backgroundColor: '#f5c400' },
  pendingButtonVerificationText: { fontSize: 13, fontWeight: '600', color: '#3d2e00' },
  pendingButtonPayment: { backgroundColor: palette.primary },
  pendingButtonPaymentText: { fontSize: 13, fontWeight: '600', color: palette.onPrimary },
  link: { fontSize: 13, fontWeight: '600', color: palette.primary },
  auditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  auditDot: { width: 8, height: 8, borderRadius: 4 },
  auditTitle: { fontSize: 14, fontWeight: '500', color: palette.onSurface },
  breakdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  breakdownCount: { fontWeight: '700', color: palette.primary },
});

export default AdminDashboardScreen;
