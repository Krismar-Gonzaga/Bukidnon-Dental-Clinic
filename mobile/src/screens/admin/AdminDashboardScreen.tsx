// Platform overview for phones (web: pages/admin/AdminDashboardPage.jsx).
// Aggregates only: no patient-level data.
import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { AdminScreen, useOpenAdmin } from '../../components/admin/AdminChrome';
import { EmptyState, LoadState, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { activityText, APPLICATION_STATUS_LABELS, fetchAdminDashboard, fetchSystemHealth } from '../../services/admin';
import { formatCount, formatDateTime } from '../../services/clinicPortal';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';

const HIGH_QUEUE = 5;
const HEALTH_LABEL = { healthy: 'Healthy', degraded: 'Degraded', down: 'Down' };

function Stat({ label, value, icon, badge, featured, onPress }: { label: string; value: string; icon: string; badge?: { text: string; warn?: boolean }; featured?: boolean; onPress?: () => void }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={[styles.stat, featured && styles.statFeatured]} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${label}: ${value}${badge ? `, ${badge.text}` : ''}`}>
      <View style={styles.statTop}>
        <View style={[styles.statIcon, featured && styles.statIconFeatured]}>
          <Icon name={icon} size={20} color={featured ? palette.onPrimary : palette.primary} />
        </View>
        {badge ? <Text style={[styles.statBadge, badge.warn && styles.warn, featured && styles.statBadgeFeatured]}>{badge.text}</Text> : null}
      </View>
      <Text style={[styles.statLabel, featured && styles.statLabelFeatured]}>{label}</Text>
      <Text style={[styles.statValue, featured && styles.onPrimary]}>{value}</Text>
    </Wrapper>
  );
}

const AdminDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const open = useOpenAdmin('AdminDashboard');
  const dashboard = useLoader(fetchAdminDashboard, [], 'The overview could not be loaded.');
  const health = useLoader(fetchSystemHealth, [], 'Unavailable');
  useRefreshOnFocus(() => {
    dashboard.sync();
    health.sync();
  });
  const data = dashboard.data;
  const database = health.data?.checks.find((c) => c.key === 'database');

  return (
    <AdminScreen title="Dashboard" active="AdminDashboard">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={dashboard.refreshing}
            onRefresh={() => {
              dashboard.refresh();
              health.sync();
            }}
            colors={[palette.primary]}
          />
        }
      >
        {!data ? (
          <LoadState loading={dashboard.loading} error={dashboard.error} onRetry={dashboard.reload} />
        ) : (
          <>
            <View style={styles.stats}>
              <Stat label="Total Clinics" value={formatCount(data.clinics.total)} icon="business-outline" badge={{ text: `+${formatCount(data.clinics.new_this_month)} this month` }} />
              <Stat
                label="Listed Clinics"
                value={formatCount(data.clinics.listed)}
                icon="location-outline"
                badge={data.clinics.suspended ? { text: `${formatCount(data.clinics.suspended)} suspended`, warn: true } : { text: 'Stable' }}
              />
              <Stat
                label="Pending Verifications"
                value={formatCount(data.applications.pending + data.applications.under_review)}
                icon="shield-checkmark-outline"
                badge={data.applications.pending + data.applications.under_review >= HIGH_QUEUE ? { text: 'High', warn: true } : { text: 'Normal' }}
                onPress={() => open('AdminApplications')}
              />
              <Stat
                label="System Health"
                value={health.data ? HEALTH_LABEL[health.data.status] : health.loading ? '…' : 'Unknown'}
                icon="pulse-outline"
                featured
                badge={database ? { text: database.detail.replace('Responding in ', '') } : undefined}
                onPress={() => open('AdminSettings')}
              />
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Registration Queue</Text>
                <TouchableOpacity onPress={() => open('AdminApplications')} accessibilityRole="link" style={styles.linkTouch}>
                  <Text style={styles.link}>View All Queue</Text>
                </TouchableOpacity>
              </View>
              {data.queue.length === 0 ? (
                <EmptyState icon="checkmark-done-outline" text="No clinics are waiting for verification." />
              ) : (
                data.queue.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={styles.queueRow}
                    onPress={() => navigation.navigate('AdminApplicationDetail', { applicationId: a.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`Review ${a.clinic_name}, ${APPLICATION_STATUS_LABELS[a.status]}`}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.queueName} numberOfLines={1}>{a.clinic_name}</Text>
                      <Text style={styles.muted}>
                        {[a.city, a.province].filter(Boolean).join(', ') || '—'} · {a.submitted_at ? formatDateTime(a.submitted_at) : 'Not submitted'}
                      </Text>
                    </View>
                    <Text style={[styles.chip, a.status === 'pending' ? styles.chipPending : styles.chipReview]}>{APPLICATION_STATUS_LABELS[a.status]}</Text>
                    <Icon name="eye-outline" size={20} color={palette.primary} />
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Platform Activity</Text>
                <Text style={styles.total}>{formatCount(data.activity_by_day.reduce((s, d) => s + d.total, 0))} events</Text>
              </View>
              <View style={styles.bars} accessible accessibilityLabel={`Audited events per day, last ${data.activity_by_day.length} days`}>
                {data.activity_by_day.map((d, i) => {
                  const max = Math.max(1, ...data.activity_by_day.map((x) => x.total));
                  return (
                    <View key={d.date} style={styles.barSlot}>
                      <View style={[styles.bar, i >= data.activity_by_day.length - 5 && styles.barRecent, { height: `${Math.max(4, (d.total / max) * 100)}%` }]} />
                    </View>
                  );
                })}
              </View>
              <Text style={styles.muted}>Last 14 days</Text>
            </View>

            <View style={styles.card}>
              <Text style={[styles.cardTitle, styles.spaced]}>Recent Activity</Text>
              {data.recent_activity.length === 0 ? (
                <EmptyState icon="time-outline" text="No platform activity yet." />
              ) : (
                data.recent_activity.map((item) => (
                  <View key={item.id} style={styles.feedRow}>
                    <View style={styles.feedDot} />
                    <View style={styles.flex}>
                      <Text style={styles.feedText}>{activityText(item)}</Text>
                      <Text style={styles.muted}>{formatDateTime(item.created_at)}</Text>
                    </View>
                  </View>
                ))
              )}
              <TouchableOpacity style={styles.outlineButton} onPress={() => open('AdminAuditLog')} accessibilityRole="button">
                <Text style={styles.outlineText}>View Activity Logs</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.security}>
              <Text style={styles.securityTitle}>Security Overview</Text>
              <Text style={styles.muted}>Sign-in failures, blocked accounts and admin password checks from the audit log.</Text>
              <View style={styles.securityStats}>
                {[
                  { label: 'Failed sign-ins (24 h)', value: data.security.failed_logins_24h, alert: data.security.failed_logins_24h >= 10 },
                  { label: 'Blocked sign-ins (24 h)', value: data.security.blocked_logins_24h, alert: data.security.blocked_logins_24h > 0 },
                  { label: 'Failed admin password checks', value: data.security.failed_password_confirmations_24h, alert: data.security.failed_password_confirmations_24h > 0 },
                  { label: 'Suspended accounts', value: data.security.suspended_users },
                  { label: 'Open review reports', value: data.open_review_reports },
                ].map((s) => (
                  <View key={s.label} style={[styles.securityStat, s.alert && styles.securityAlert]}>
                    <Text style={styles.securityLabel}>{s.label}</Text>
                    <Text style={styles.securityValue}>{formatCount(s.value)}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.outlineButton, styles.flex]} onPress={() => open('AdminAuditLog', { action: 'auth.login_failed' })} accessibilityRole="button">
                  <Text style={styles.outlineText}>Detailed Audit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryButton, styles.flex]} onPress={() => open('AdminUsers', { status: 'suspended' })} accessibilityRole="button">
                  <Text style={styles.primaryText}>Review Accounts</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  muted: { fontSize: 12, color: palette.onSurfaceVariant },
  onPrimary: { color: palette.onPrimary },
  warn: { color: palette.error },
  spaced: { marginBottom: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { width: '48%', flexGrow: 1, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(194,198,212,0.3)', backgroundColor: palette.surfaceContainerLowest, ...shadow.sm },
  statFeatured: { backgroundColor: palette.primary, borderColor: palette.primary },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.xs, marginBottom: spacing.xs },
  statIcon: { padding: spacing.base, borderRadius: radius.lg, backgroundColor: 'rgba(0,63,135,0.1)' },
  statIconFeatured: { backgroundColor: 'rgba(255,255,255,0.2)' },
  statBadge: { ...type.labelMd, color: palette.secondary, flexShrink: 1, textAlign: 'right' },
  statBadgeFeatured: { color: palette.secondaryContainer },
  statLabel: { ...type.labelMd, color: palette.onSurfaceVariant, textTransform: 'uppercase', marginTop: spacing.xs },
  statLabelFeatured: { color: 'rgba(255,255,255,0.75)' },
  statValue: { fontSize: 28, lineHeight: 36, fontWeight: '600', color: palette.onSurface },
  card: { padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(194,198,212,0.3)', backgroundColor: palette.surfaceContainerLowest, ...shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  cardTitle: { ...type.titleLg, color: palette.onSurface },
  linkTouch: { minHeight: 44, justifyContent: 'center' },
  link: { ...type.labelMd, color: palette.primary },
  total: { ...type.labelMd, color: palette.secondary },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: palette.surfaceContainerHigh, minHeight: 56 },
  queueName: { ...type.bodyMd, fontWeight: '600', color: palette.onSurface },
  chip: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.sm, overflow: 'hidden' },
  chipPending: { backgroundColor: palette.errorContainer, color: palette.onErrorContainer },
  chipReview: { backgroundColor: palette.tertiaryFixed, color: palette.onTertiaryFixedVariant },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 112, marginBottom: spacing.sm },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: 'rgba(0,63,135,0.2)' },
  barRecent: { backgroundColor: 'rgba(0,63,135,0.35)', borderTopWidth: 2, borderTopColor: palette.primary },
  feedRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  feedDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: palette.primary },
  feedText: { ...type.bodyMd, color: palette.onSurface },
  outlineButton: { marginTop: spacing.md, minHeight: 44, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  outlineText: { ...type.labelMd, color: palette.onSurfaceVariant },
  primaryButton: { marginTop: spacing.md, minHeight: 44, borderRadius: radius.lg, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...type.labelMd, color: palette.onPrimary },
  security: { padding: spacing.lg, borderRadius: radius.xxl, borderWidth: 1, borderColor: 'rgba(222,226,230,0.8)', backgroundColor: 'rgba(255,255,255,0.7)', gap: spacing.xs },
  securityTitle: { ...type.headlineMd, color: palette.primary },
  securityStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  securityStat: { width: '47%', flexGrow: 1, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLow },
  securityAlert: { backgroundColor: palette.errorContainer },
  securityLabel: { fontSize: 11, fontWeight: '600', color: palette.onSurfaceVariant },
  securityValue: { ...type.titleLg, fontWeight: '700', color: palette.onSurface },
});

export default AdminDashboardScreen;
