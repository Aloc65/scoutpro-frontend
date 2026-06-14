import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import EmptyState from '../../src/components/EmptyState';
import { Colors } from '../../src/theme/colors';
import { showAlert } from '../../src/utils/alert';
import { useAuth } from '../../src/context/AuthContext';
import {
  SECURITY_ALERT_TYPE_LABELS,
  SecurityAlert,
  SecurityAlertListResponse,
  SecurityAlertSeverity,
  SecurityAlertType,
} from '../../src/types';

const TYPE_FILTER_OPTIONS: ('All' | SecurityAlertType)[] = [
  'All',
  'FAILED_LOGIN',
  'LARGE_EXPORT',
  'UNUSUAL_ACTIVITY',
];
const STATUS_FILTER_OPTIONS = ['All', 'NEW', 'ACKNOWLEDGED'] as const;
const PAGE_SIZE = 25;

function formatTimestamp(ts: string): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${h}:${mins} ${ampm}`;
}

function severityColor(severity: SecurityAlertSeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return Colors.error;
    case 'HIGH':
      return Colors.orange;
    case 'MEDIUM':
      return Colors.amber;
    case 'LOW':
    default:
      return Colors.accent;
  }
}

function typeIcon(type: SecurityAlertType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'FAILED_LOGIN':
      return 'lock-closed-outline';
    case 'LARGE_EXPORT':
      return 'cloud-download-outline';
    case 'UNUSUAL_ACTIVITY':
      return 'warning-outline';
    default:
      return 'shield-outline';
  }
}

export default function SecurityAlertsScreen() {
  const { user } = useAuth();

  const [items, setItems] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<'All' | SecurityAlertType>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [newCount, setNewCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (typeFilter !== 'All') params.set('type', typeFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);
      const data = await api.get<SecurityAlertListResponse>(`/api/security-alerts?${params.toString()}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setNewCount(data.newCount || 0);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to load security alerts');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      load();
    }
  }, [load, user?.role]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const acknowledge = useCallback(
    async (id: string) => {
      setAcknowledging(id);
      try {
        await api.patch(`/api/security-alerts/${id}/acknowledge`);
        await load();
      } catch (e: any) {
        showAlert('Error', e.message || 'Failed to acknowledge alert');
      } finally {
        setAcknowledging(null);
      }
    },
    [load],
  );

  const applyFilterReset = () => setPage(1);

  // Admin-only access check
  if (user?.role !== 'ADMIN') {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={48} color={Colors.textMuted} />
        <Text style={styles.accessDenied}>Admin Only</Text>
        <Text style={styles.accessDeniedSub}>You do not have permission to access this page.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Summary banner */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{total}</Text>
            <Text style={styles.summaryLabel}>Total Alerts</Text>
          </View>
          <View style={[styles.summaryCard, newCount > 0 && styles.summaryCardAlert]}>
            <Text style={[styles.summaryValue, newCount > 0 && { color: Colors.error }]}>{newCount}</Text>
            <Text style={styles.summaryLabel}>Unacknowledged</Text>
          </View>
        </View>

        <View style={styles.filterWrap}>
          <Text style={styles.filterLabel}>Alert Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {TYPE_FILTER_OPTIONS.map((option) => {
              const isActive = typeFilter === option;
              const label = option === 'All' ? 'All' : SECURITY_ALERT_TYPE_LABELS[option];
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => {
                    setTypeFilter(option);
                    applyFilterReset();
                  }}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.filterLabel}>Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_FILTER_OPTIONS.map((option) => {
              const isActive = statusFilter === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => {
                    setStatusFilter(option);
                    applyFilterReset();
                  }}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {option === 'All' ? 'All' : option === 'NEW' ? 'New' : 'Acknowledged'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.countText}>{total} alert{total === 1 ? '' : 's'}</Text>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState icon="shield-checkmark-outline" message="No security alerts match your filters" />
        ) : (
          <View style={styles.list}>
            {items.map((alert) => {
              const color = severityColor(alert.severity);
              const isNew = alert.status === 'NEW';
              return (
                <View key={alert.id} style={[styles.alertCard, { borderLeftColor: color }]}>
                  <View style={styles.alertHeader}>
                    <View style={styles.alertHeaderLeft}>
                      <Ionicons name={typeIcon(alert.type)} size={18} color={color} />
                      <Text style={styles.alertType}>{SECURITY_ALERT_TYPE_LABELS[alert.type] || alert.type}</Text>
                    </View>
                    <View style={[styles.severityBadge, { backgroundColor: color }]}>
                      <Text style={styles.severityText}>{alert.severity}</Text>
                    </View>
                  </View>

                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertMessage}>{alert.message}</Text>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
                      <Text style={styles.metaText}>{alert.username || 'Unknown'}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="globe-outline" size={13} color={Colors.textMuted} />
                      <Text style={styles.metaText}>{alert.ipAddress || 'Unknown'}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
                      <Text style={styles.metaText}>{formatTimestamp(alert.createdAt)}</Text>
                    </View>
                  </View>

                  <View style={styles.footerRow}>
                    <View style={styles.notifyRow}>
                      <View style={styles.notifyBadge}>
                        <Ionicons
                          name={alert.emailSent ? 'mail' : 'mail-outline'}
                          size={13}
                          color={alert.emailSent ? Colors.green : Colors.textMuted}
                        />
                        <Text style={[styles.notifyText, alert.emailSent && { color: Colors.green }]}>
                          {alert.emailSent ? 'Email sent' : 'No email'}
                        </Text>
                      </View>
                      <View style={styles.notifyBadge}>
                        <Ionicons
                          name={alert.smsSent ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                          size={13}
                          color={alert.smsSent ? Colors.green : Colors.textMuted}
                        />
                        <Text style={[styles.notifyText, alert.smsSent && { color: Colors.green }]}>
                          {alert.smsSent ? 'SMS sent' : 'No SMS'}
                        </Text>
                      </View>
                    </View>

                    {isNew ? (
                      <TouchableOpacity
                        style={styles.ackBtn}
                        onPress={() => acknowledge(alert.id)}
                        disabled={acknowledging === alert.id}
                      >
                        {acknowledging === alert.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                            <Text style={styles.ackBtnText}>Acknowledge</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.ackedPill}>
                        <Ionicons name="checkmark-done" size={14} color={Colors.green} />
                        <Text style={styles.ackedText}>
                          {alert.acknowledgedBy ? `Ack by ${alert.acknowledgedBy}` : 'Acknowledged'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!loading && items.length > 0 ? (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageBtn, page <= 1 && styles.disabled]}
              disabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Ionicons name="chevron-back" size={16} color={Colors.text} />
              <Text style={styles.pageBtnText}>Prev</Text>
            </TouchableOpacity>
            <Text style={styles.pageIndicator}>
              Page {page} of {totalPages}
            </Text>
            <TouchableOpacity
              style={[styles.pageBtn, page >= totalPages && styles.disabled]}
              disabled={page >= totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <Text style={styles.pageBtnText}>Next</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.text} />
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: 24 },
  centered: { paddingVertical: 48, alignItems: 'center' },
  accessDenied: { color: Colors.text, fontSize: 20, fontWeight: '700', marginTop: 12 },
  accessDeniedSub: { color: Colors.textSecondary, fontSize: 14, marginTop: 6, textAlign: 'center' },

  summaryRow: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 4 },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryCardAlert: { borderColor: Colors.error },
  summaryValue: { color: Colors.text, fontSize: 26, fontWeight: '800' },
  summaryLabel: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },

  filterWrap: { paddingHorizontal: 16, paddingTop: 8 },
  filterLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  chipRow: { gap: 8, paddingRight: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  countText: { color: Colors.textMuted, fontSize: 13, marginTop: 14 },

  list: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  alertCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alertHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertType: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  severityText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  alertTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginTop: 8 },
  alertMessage: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: Colors.textMuted, fontSize: 12 },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexWrap: 'wrap',
    gap: 10,
  },
  notifyRow: { flexDirection: 'row', gap: 12 },
  notifyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notifyText: { color: Colors.textMuted, fontSize: 12 },

  ackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ackBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  ackedPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ackedText: { color: Colors.green, fontSize: 12, fontWeight: '600' },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20 },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
  pageBtnText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  pageIndicator: { color: Colors.textSecondary, fontSize: 13 },
  disabled: { opacity: 0.4 },
});
