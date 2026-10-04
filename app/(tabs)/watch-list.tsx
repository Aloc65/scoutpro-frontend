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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getToken } from '../../src/api/client';
import EmptyState from '../../src/components/EmptyState';
import { Colors } from '../../src/theme/colors';
import { showAlert } from '../../src/utils/alert';
import { PipelineStage, WatchList, AUSTRALIAN_STATES } from '../../src/types';
import BoardView from '../../src/features/watchlist/BoardView';
import TableView from '../../src/features/watchlist/TableView';
import QuickViewSheet from '../../src/features/watchlist/QuickViewSheet';
import PriorityEditorSheet from '../../src/features/watchlist/PriorityEditorSheet';
import { hasActiveAflInterest } from '../../src/features/watchlist/pipeline';
import { updatePriority as apiUpdatePriority } from '../../src/api/watchList';

type ViewMode = 'board' | 'table';
const VIEW_MODE_KEY = 'watchlist_view_mode';
const STATE_FILTER_OPTIONS = ['All', ...AUSTRALIAN_STATES] as const;

// Sort options (label -> backend sortBy value). "Priority first" is the default;
// "Manual order" preserves the drag-reorder ranking as a separate option.
const SORT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Priority first', value: 'priority' },
  { label: 'Manual order', value: 'rank' },
  { label: 'Surname', value: 'surname' },
  { label: 'Club', value: 'club' },
];
// Priority filter (label -> backend `priority` param; '' = no filter).
const PRIORITY_FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'High', value: '1' },
  { label: 'Medium', value: '2' },
  { label: 'Monitor', value: '3' },
  { label: 'Hold', value: '4' },
  { label: 'Not set', value: 'none' },
];
// Contact-permission filter (label -> backend `contactPermission` param).
const CONTACT_FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Allowed', value: 'ALLOWED' },
  { label: 'Not allowed', value: 'NOT_ALLOWED' },
  { label: 'Unconfirmed', value: 'NOT_RECORDED' },
];
const labelToValue = (opts: { label: string; value: string }[], label: string) =>
  opts.find((o) => o.label === label)?.value ?? '';

// Module-level caches so selections survive navigating away/back within a session.
let cachedViewMode: ViewMode = 'board';
let persistedStateFilter = 'All';
let persistedDraftYear = 'All';
let persistedSort = 'Priority first';
let persistedPriorityFilter = 'All';
let persistedContactFilter = 'All';

// ─── Small dropdown (modal picker) ───────────────────────────────────
function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TouchableOpacity style={styles.dropdown} onPress={() => setOpen(true)}>
        <Text style={styles.dropdownValue} numberOfLines={1}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.pickerOption, value === opt && styles.pickerOptionActive]}
                  onPress={() => { onChange(opt); setOpen(false); }}
                >
                  <Text style={[styles.pickerOptionText, value === opt && styles.pickerOptionTextActive]}>{opt}</Text>
                  {value === opt && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function WatchListScreen() {
  const [items, setItems] = useState<WatchList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>(cachedViewMode);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState(persistedStateFilter);
  const [draftYear, setDraftYear] = useState(persistedDraftYear);
  const [availableDraftYears, setAvailableDraftYears] = useState<string[]>(['All']);
  const [aflOnly, setAflOnly] = useState(false);
  const [sortLabel, setSortLabel] = useState(persistedSort);
  const [priorityFilter, setPriorityFilter] = useState(persistedPriorityFilter);
  const [contactFilter, setContactFilter] = useState(persistedContactFilter);

  const [quickViewEntry, setQuickViewEntry] = useState<WatchList | null>(null);
  const [priorityEditEntry, setPriorityEditEntry] = useState<WatchList | null>(null);

  // Load persisted view mode once.
  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY).then((v) => {
      if (v === 'board' || v === 'table') {
        cachedViewMode = v;
        setViewMode(v);
      }
    });
  }, []);

  const setViewModePersisted = useCallback((mode: ViewMode) => {
    cachedViewMode = mode;
    setViewMode(mode);
    AsyncStorage.setItem(VIEW_MODE_KEY, mode).catch(() => {});
  }, []);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (stateFilter !== 'All') params.set('state', stateFilter);
    if (draftYear !== 'All') params.set('draftYear', draftYear);
    const sortBy = labelToValue(SORT_OPTIONS, sortLabel) || 'priority';
    params.set('sortBy', sortBy);
    const priorityVal = labelToValue(PRIORITY_FILTER_OPTIONS, priorityFilter);
    if (priorityVal) params.set('priority', priorityVal);
    const contactVal = labelToValue(CONTACT_FILTER_OPTIONS, contactFilter);
    if (contactVal) params.set('contactPermission', contactVal);
    const q = params.toString();
    return q ? `?${q}` : '';
  }, [search, stateFilter, draftYear, sortLabel, priorityFilter, contactFilter]);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ items: WatchList[]; total: number }>(`/api/watch-list${buildQueryString()}`);
      const next = data.items || [];
      setItems(next);

      const years = next
        .map((i) => i.draftYear)
        .filter((v): v is number => typeof v === 'number')
        .map(String);
      if (years.length > 0) {
        setAvailableDraftYears((prev) => {
          const merged = Array.from(new Set([...prev.filter((y) => y !== 'All'), ...years])).sort(
            (a, b) => Number(a) - Number(b),
          );
          return ['All', ...merged];
        });
      }
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to load watch list');
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Persist filter selections at module scope.
  const changeState = (v: string) => { persistedStateFilter = v; setStateFilter(v); };
  const changeDraftYear = (v: string) => { persistedDraftYear = v; setDraftYear(v); };
  const changeSort = (v: string) => { persistedSort = v; setSortLabel(v); };
  const changePriorityFilter = (v: string) => { persistedPriorityFilter = v; setPriorityFilter(v); };
  const changeContactFilter = (v: string) => { persistedContactFilter = v; setContactFilter(v); };

  const filtersActive =
    !!search.trim() ||
    stateFilter !== 'All' ||
    draftYear !== 'All' ||
    priorityFilter !== 'All' ||
    contactFilter !== 'All' ||
    aflOnly ||
    sortLabel !== 'Priority first';

  const resetFilters = () => {
    persistedStateFilter = 'All';
    persistedDraftYear = 'All';
    persistedSort = 'Priority first';
    persistedPriorityFilter = 'All';
    persistedContactFilter = 'All';
    setSearch('');
    setStateFilter('All');
    setDraftYear('All');
    setSortLabel('Priority first');
    setPriorityFilter('All');
    setContactFilter('All');
    setAflOnly(false);
  };

  // ─── Inline priority change — save then refetch so cards reposition ──
  const handleSavePriority = useCallback(
    async (playerId: string, priority: number | null, reason: string | null) => {
      const prev = items;
      // Optimistic update so the badge changes immediately.
      setItems((cur) =>
        cur.map((i) => (i.playerId === playerId ? { ...i, priority, priorityReason: reason } : i)),
      );
      try {
        await apiUpdatePriority(playerId, priority, reason);
        // Refetch to re-apply the server's priority-first ordering.
        await load();
      } catch (e: any) {
        setItems(prev); // restore previous value on failure
        showAlert('Error', e.message || 'Failed to update priority');
        throw e;
      }
    },
    [items, load],
  );

  const aflInterestCount = useMemo(
    () => items.filter((i) => hasActiveAflInterest(i)).length,
    [items],
  );

  const visibleItems = useMemo(
    () => (aflOnly ? items.filter((i) => hasActiveAflInterest(i)) : items),
    [items, aflOnly],
  );

  // ─── Stage change (board drag) — optimistic ───────────────────────
  const handleStageChange = useCallback(
    async (playerId: string, newStage: PipelineStage) => {
      const prev = items;
      setItems((cur) =>
        cur.map((i) =>
          i.playerId === playerId
            ? { ...i, stage: newStage, signedStatus: newStage === 'SIGNED' ? 'Signed' : 'Unsigned' }
            : i,
        ),
      );
      try {
        const updated = await api.patch<WatchList>(`/api/watch-list/${playerId}/stage`, { stage: newStage });
        setItems((cur) => cur.map((i) => (i.playerId === playerId ? { ...i, ...updated } : i)));
      } catch (e: any) {
        setItems(prev); // revert
        showAlert('Error', e.message || 'Failed to change stage');
      }
    },
    [items],
  );

  // ─── Reorder (table drag) ──────────────────────────────────────────
  const handleReorder = useCallback(
    async (orderedPlayerIds: string[]) => {
      try {
        const body: any = { orderedPlayerIds };
        if (draftYear !== 'All') body.draftYear = Number(draftYear);
        await api.patch(`/api/watch-list/reorder`, body);
        await load();
      } catch (e: any) {
        showAlert('Error', e.message || 'Failed to save new order');
        await load();
      }
    },
    [draftYear, load],
  );

  const handleEntryChanged = useCallback((updated: WatchList) => {
    setItems((cur) => cur.map((i) => (i.playerId === updated.playerId ? { ...i, ...updated } : i)));
  }, []);

  const exportExcel = async () => {
    try {
      setExporting(true);
      const token = await getToken();
      // Reflect the AFL-interest chip in the export via query params.
      const params = new URLSearchParams(buildQueryString().replace(/^\?/, ''));
      if (aflOnly) {
        params.set('hasAflInterest', 'true');
        params.set('signedStatus', 'Unsigned');
      }
      const q = params.toString();
      const res = await fetch(`${api.baseUrl}/api/watch-list/export${q ? `?${q}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Export failed: ${res.status}`);
      }
      const blob = await res.blob();
      const filename = `watch-list-${new Date().toISOString().slice(0, 10)}.xlsx`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showAlert('Success', 'Excel export completed.');
      } else {
        showAlert('Info', 'Excel export download is currently available on web.');
      }
    } catch (e: any) {
      showAlert('Export Error', e.message || 'Failed to export watch list');
    } finally {
      setExporting(false);
    }
  };

  const draftYearOptions = useMemo(() => {
    if (draftYear === 'All' || availableDraftYears.includes(draftYear)) return availableDraftYears;
    const merged = Array.from(new Set([...availableDraftYears.filter((y) => y !== 'All'), draftYear])).sort(
      (a, b) => Number(a) - Number(b),
    );
    return ['All', ...merged];
  }, [availableDraftYears, draftYear]);

  return (
    <View style={styles.container}>
      {/* ─── Shared header ─── */}
      <View style={styles.header}>
        {/* Segmented control + export */}
        <View style={styles.topRow}>
          <View style={styles.segmented}>
            {(['board', 'table'] as ViewMode[]).map((mode) => {
              const active = viewMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => setViewModePersisted(mode)}
                >
                  <Ionicons
                    name={mode === 'board' ? 'grid-outline' : 'list-outline'}
                    size={15}
                    color={active ? '#fff' : Colors.textSecondary}
                  />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {mode === 'board' ? 'Board' : 'Table'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={[styles.exportBtn, exporting && styles.disabled]} onPress={exportExcel} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color={Colors.text} />
            ) : (
              <>
                <Ionicons name="download-outline" size={16} color={Colors.text} />
                <Text style={styles.exportBtnText}>Export</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by player name"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
        </View>

        {/* Dropdown filters */}
        <View style={styles.filtersRow}>
          <Dropdown label="State" value={stateFilter} options={[...STATE_FILTER_OPTIONS]} onChange={changeState} />
          <Dropdown label="Draft Year" value={draftYear} options={draftYearOptions} onChange={changeDraftYear} />
          <Dropdown
            label="Sort by"
            value={sortLabel}
            options={SORT_OPTIONS.map((o) => o.label)}
            onChange={changeSort}
          />
        </View>
        <View style={styles.filtersRow}>
          <Dropdown
            label="Priority"
            value={priorityFilter}
            options={PRIORITY_FILTER_OPTIONS.map((o) => o.label)}
            onChange={changePriorityFilter}
          />
          <Dropdown
            label="Contact permission"
            value={contactFilter}
            options={CONTACT_FILTER_OPTIONS.map((o) => o.label)}
            onChange={changeContactFilter}
          />
          {filtersActive && (
            <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
              <Ionicons name="close-circle" size={15} color={Colors.textSecondary} />
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* AFL-interest count chip */}
        {aflInterestCount > 0 && (
          <TouchableOpacity
            style={[styles.aflChip, aflOnly && styles.aflChipActive]}
            onPress={() => setAflOnly((v) => !v)}
          >
            <Ionicons name="flame" size={14} color={aflOnly ? '#fff' : Colors.orange} />
            <Text style={[styles.aflChipText, aflOnly && { color: '#fff' }]}>
              {aflInterestCount} unsigned with AFL interest
            </Text>
            {aflOnly && <Ionicons name="close" size={14} color="#fff" />}
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Content ─── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon="eye-outline" message="No players in watch list yet" />
      ) : viewMode === 'board' ? (
        <BoardView
          items={visibleItems}
          onCardPress={setQuickViewEntry}
          onStageChange={handleStageChange}
          onEditPriority={setPriorityEditEntry}
        />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          contentContainerStyle={{ paddingTop: 8 }}
        >
          <TableView
            items={visibleItems}
            onRowPress={setQuickViewEntry}
            onReorder={handleReorder}
            onEditPriority={setPriorityEditEntry}
          />
        </ScrollView>
      )}

      <QuickViewSheet
        visible={!!quickViewEntry}
        entry={quickViewEntry}
        onClose={() => setQuickViewEntry(null)}
        onEntryChanged={handleEntryChanged}
      />

      <PriorityEditorSheet
        visible={!!priorityEditEntry}
        entry={priorityEditEntry}
        onClose={() => setPriorityEditEntry(null)}
        onSave={handleSavePriority}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  segmented: { flexDirection: 'row', backgroundColor: Colors.elevated, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: Colors.border },
  segment: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  segmentActive: { backgroundColor: Colors.primary },
  segmentText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 13 },
  segmentTextActive: { color: '#fff' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  exportBtnText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.6 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.elevated,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: Colors.text, paddingVertical: 9, marginLeft: 8 },

  filtersRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 10,
  },
  resetBtnText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 12 },
  dropdownLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  dropdownValue: { color: Colors.text, fontWeight: '600', fontSize: 13, flex: 1 },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 40 },
  pickerCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  pickerTitle: { color: Colors.text, fontWeight: '800', fontSize: 15, marginBottom: 10 },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8,
  },
  pickerOptionActive: { backgroundColor: Colors.elevated },
  pickerOptionText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  pickerOptionTextActive: { color: Colors.text },

  aflChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
  },
  aflChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  aflChipText: { color: Colors.orange, fontWeight: '700', fontSize: 12 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
