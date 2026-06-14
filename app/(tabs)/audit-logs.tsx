import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, getToken } from '../../src/api/client';
import EmptyState from '../../src/components/EmptyState';
import { Colors } from '../../src/theme/colors';
import { showAlert } from '../../src/utils/alert';
import { useAuth } from '../../src/context/AuthContext';
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  AuditAction,
  AuditLog,
  AuditLogListResponse,
} from '../../src/types';

const ACTION_FILTER_OPTIONS: ('All' | AuditAction)[] = ['All', ...AUDIT_ACTIONS];
const ENTITY_FILTER_OPTIONS = ['All', 'Auth', 'User', 'Report', 'Player', 'WatchList', 'AuditLog'] as const;
const PAGE_SIZE = 25;

/**
 * Normalise a user-entered date into a strict ISO 8601 date string
 * (YYYY-MM-DD) that the backend's @IsDateString() validator accepts.
 *
 * The date filter inputs are free text, so users can type loose formats like
 * "2026-6-1" or "6/14/2026" which class-validator rejects with
 * "start date must be valid ISO 8601 date string". This helper parses such
 * inputs and re-emits them in strict YYYY-MM-DD form. Returns '' when the
 * input is empty or cannot be parsed (so the param is simply omitted).
 *
 * Local date components are used (not toISOString) to avoid an off-by-one-day
 * shift caused by timezone conversion to UTC.
 */
function normalizeDateParam(input: string): string {
  const t = (input || '').trim();
  if (!t) return '';
  // Already strict YYYY-MM-DD — pass through unchanged.
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Inline style for the native web <input type="date"> so it visually matches
// the app's dark themed text inputs.
const webDateInputStyle: any = {
  width: '100%',
  backgroundColor: Colors.elevated,
  color: Colors.text,
  border: `1px solid ${Colors.border}`,
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  boxSizing: 'border-box',
  outline: 'none',
};

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

function summariseDetails(log: AuditLog): string {
  if (!log.details) return '—';
  try {
    const entries = Object.entries(log.details);
    if (entries.length === 0) return '—';
    return entries
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(', ');
  } catch {
    return '—';
  }
}

export default function AuditLogsScreen() {
  const { user } = useAuth();

  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<'All' | AuditAction>('All');
  const [entityFilter, setEntityFilter] = useState<string>('All');
  const [userFilter, setUserFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [userOptions, setUserOptions] = useState<{ userId: string; username: string }[]>([]);
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  const buildQueryString = useCallback(
    (overridePage?: number) => {
      const params = new URLSearchParams();
      params.set('page', String(overridePage ?? page));
      params.set('limit', String(PAGE_SIZE));
      if (search.trim()) params.set('search', search.trim());
      if (actionFilter !== 'All') params.set('action', actionFilter);
      if (entityFilter !== 'All') params.set('entity', entityFilter);
      if (userFilter !== 'All') params.set('userId', userFilter);
      const normalizedStart = normalizeDateParam(startDate);
      const normalizedEnd = normalizeDateParam(endDate);
      if (normalizedStart) params.set('startDate', normalizedStart);
      if (normalizedEnd) params.set('endDate', normalizedEnd);
      return params.toString();
    },
    [page, search, actionFilter, entityFilter, userFilter, startDate, endDate],
  );

  const load = useCallback(async () => {
    try {
      const query = buildQueryString();
      const data = await api.get<AuditLogListResponse>(`/api/audit-logs?${query}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  const loadUserOptions = useCallback(async () => {
    try {
      const data = await api.get<{ users: { userId: string; username: string }[] }>(
        '/api/audit-logs/filter-options',
      );
      setUserOptions(data.users || []);
    } catch {
      // non-fatal — user filter just stays empty
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      load();
    }
  }, [load, user?.role]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadUserOptions();
    }
  }, [loadUserOptions, user?.role]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Reset to page 1 whenever a filter changes.
  const applyFilterReset = () => setPage(1);

  const clearFilters = () => {
    setSearch('');
    setActionFilter('All');
    setEntityFilter('All');
    setUserFilter('All');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const exportLogs = async (format: 'xlsx' | 'csv') => {
    try {
      setExporting(true);
      const token = await getToken();
      const query = buildQueryString(1);
      const res = await fetch(`${api.baseUrl}/api/audit-logs/export?${query}&format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Export failed: ${res.status}`);
      }
      const blob = await res.blob();
      const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.${format}`;

      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showAlert('Success', `Audit logs exported as ${format.toUpperCase()}.`);
      } else {
        showAlert('Info', 'Export download is currently available on web.');
      }
    } catch (e: any) {
      showAlert('Export Error', e.message || 'Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  const selectedUserLabel = useMemo(() => {
    if (userFilter === 'All') return 'All Users';
    const found = userOptions.find((u) => u.userId === userFilter);
    return found?.username || userFilter;
  }, [userFilter, userOptions]);

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
        <View style={styles.filterWrap}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={(t) => {
                setSearch(t);
                applyFilterReset();
              }}
              placeholder="Search user, entity, IP address"
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
            />
          </View>

          <Text style={styles.filterLabel}>Date Range</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={styles.dateHint}>From</Text>
              {Platform.OS === 'web' ? (
                // Native browser date picker guarantees a strict YYYY-MM-DD value.
                <input
                  type="date"
                  value={startDate}
                  onChange={(e: any) => {
                    setStartDate(e.target.value);
                    applyFilterReset();
                  }}
                  style={webDateInputStyle}
                />
              ) : (
                <TextInput
                  value={startDate}
                  onChangeText={(t) => {
                    setStartDate(t);
                    applyFilterReset();
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.dateInput}
                />
              )}
            </View>
            <View style={styles.dateField}>
              <Text style={styles.dateHint}>To</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={endDate}
                  onChange={(e: any) => {
                    setEndDate(e.target.value);
                    applyFilterReset();
                  }}
                  style={webDateInputStyle}
                />
              ) : (
                <TextInput
                  value={endDate}
                  onChangeText={(t) => {
                    setEndDate(t);
                    applyFilterReset();
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.dateInput}
                />
              )}
            </View>
          </View>

          <Text style={styles.filterLabel}>User</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setUserPickerOpen(true)}>
            <Text style={styles.dropdownText}>{selectedUserLabel}</Text>
            <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.filterLabel}>Action Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {ACTION_FILTER_OPTIONS.map((option) => {
              const isActive = actionFilter === option;
              const label = option === 'All' ? 'All' : AUDIT_ACTION_LABELS[option];
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => {
                    setActionFilter(option);
                    applyFilterReset();
                  }}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.filterLabel}>Entity Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {ENTITY_FILTER_OPTIONS.map((option) => {
              const isActive = entityFilter === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => {
                    setEntityFilter(option);
                    applyFilterReset();
                  }}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.topActions}>
            <Text style={styles.countText}>{total} log entries</Text>
            <TouchableOpacity onPress={clearFilters}>
              <Text style={styles.clearText}>Clear filters</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.exportRow}>
            <TouchableOpacity
              style={[styles.exportBtn, exporting && styles.disabled]}
              onPress={() => exportLogs('xlsx')}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={styles.exportBtnText}>Export Excel</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtnOutline, exporting && styles.disabled]}
              onPress={() => exportLogs('csv')}
              disabled={exporting}
            >
              <Ionicons name="document-text-outline" size={18} color={Colors.accent} />
              <Text style={styles.exportBtnOutlineText}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : items.length === 0 ? (
          <EmptyState icon="receipt-outline" message="No audit logs match your filters" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingHorizontal: 16 }}>
            <View style={styles.table}>
              <View style={[styles.row, styles.headerRow]}>
                <Text style={[styles.cell, styles.headerCell, styles.tsCol]}>Timestamp</Text>
                <Text style={[styles.cell, styles.headerCell, styles.userCol]}>User</Text>
                <Text style={[styles.cell, styles.headerCell, styles.actionCol]}>Action</Text>
                <Text style={[styles.cell, styles.headerCell, styles.entityCol]}>Entity</Text>
                <Text style={[styles.cell, styles.headerCell, styles.detailsCol]}>Details</Text>
                <Text style={[styles.cell, styles.headerCell, styles.ipCol]}>IP Address</Text>
                <Text style={[styles.cell, styles.headerCell, styles.statusCol]}>Result</Text>
              </View>

              {items.map((log) => (
                <View key={log.id} style={styles.row}>
                  <Text style={[styles.cell, styles.tsCol]}>{formatTimestamp(log.timestamp)}</Text>
                  <Text style={[styles.cell, styles.userCol]} numberOfLines={2}>
                    {log.username || '—'}
                  </Text>
                  <View style={[styles.cell, styles.actionCol]}>
                    <Text style={styles.actionBadge}>{AUDIT_ACTION_LABELS[log.action] || log.action}</Text>
                  </View>
                  <Text style={[styles.cell, styles.entityCol]}>
                    {log.entity || '—'}
                    {log.entityId ? `\n#${String(log.entityId).slice(0, 8)}` : ''}
                  </Text>
                  <Text style={[styles.cell, styles.detailsCol]} numberOfLines={3}>
                    {summariseDetails(log)}
                  </Text>
                  <Text style={[styles.cell, styles.ipCol]}>{log.ipAddress || '—'}</Text>
                  <View style={[styles.cell, styles.statusCol]}>
                    <Text style={[styles.statusPill, log.success ? styles.statusOk : styles.statusFail]}>
                      {log.success ? 'Success' : 'Failed'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
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

      <Modal visible={userPickerOpen} transparent animationType="slide" onRequestClose={() => setUserPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Filter by User</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              <TouchableOpacity
                style={styles.userOption}
                onPress={() => {
                  setUserFilter('All');
                  applyFilterReset();
                  setUserPickerOpen(false);
                }}
              >
                <Text style={styles.userOptionText}>All Users</Text>
                {userFilter === 'All' ? <Ionicons name="checkmark" size={18} color={Colors.accent} /> : null}
              </TouchableOpacity>
              {userOptions.map((u) => (
                <TouchableOpacity
                  key={u.userId}
                  style={styles.userOption}
                  onPress={() => {
                    setUserFilter(u.userId);
                    applyFilterReset();
                    setUserPickerOpen(false);
                  }}
                >
                  <Text style={styles.userOptionText}>{u.username}</Text>
                  {userFilter === u.userId ? <Ionicons name="checkmark" size={18} color={Colors.accent} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setUserPickerOpen(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: Colors.background },
  accessDenied: { color: Colors.text, fontSize: 20, fontWeight: '800', marginTop: 12 },
  accessDeniedSub: { color: Colors.textSecondary, fontSize: 14, marginTop: 6, textAlign: 'center' },

  filterWrap: { padding: 16, gap: 8 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: Colors.text, paddingVertical: 10, marginLeft: 8 },
  filterLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 4 },

  dateRow: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1 },
  dateHint: { color: Colors.textMuted, fontSize: 11, marginBottom: 4 },
  dateInput: {
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: Colors.text,
  },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dropdownText: { color: Colors.text, fontWeight: '600', fontSize: 13 },

  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2, paddingRight: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: '#fff' },

  topActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  countText: { color: Colors.textMuted, fontSize: 12 },
  clearText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },

  exportRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  exportBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  exportBtnText: { color: '#fff', fontWeight: '700' },
  exportBtnOutline: {
    flex: 1,
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.45)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  exportBtnOutlineText: { color: Colors.accent, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  centered: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },

  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerRow: { backgroundColor: Colors.elevated },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  headerCell: { color: Colors.text, fontWeight: '700' },
  tsCol: { width: 150 },
  userCol: { width: 150 },
  actionCol: { width: 130 },
  entityCol: { width: 120 },
  detailsCol: { width: 300 },
  ipCol: { width: 130 },
  statusCol: { width: 90, alignItems: 'flex-start', justifyContent: 'center' },
  actionBadge: { color: Colors.accent, fontWeight: '700', fontSize: 12 },
  statusPill: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  statusOk: { color: '#16a34a', backgroundColor: 'rgba(22,163,74,0.14)' },
  statusFail: { color: Colors.error, backgroundColor: 'rgba(239,68,68,0.14)' },

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pageBtnText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  pageIndicator: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  userOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  userOptionText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  modalCancel: { alignItems: 'center', marginTop: 14 },
  modalCancelText: { color: Colors.textSecondary, fontWeight: '600' },
});
