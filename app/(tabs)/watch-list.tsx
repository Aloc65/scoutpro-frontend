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
import { AFL_TEAMS } from '../../src/constants/aflTeams';
import EmptyState from '../../src/components/EmptyState';
import GradientButton from '../../src/components/GradientButton';
import { Colors } from '../../src/theme/colors';
import { showAlert } from '../../src/utils/alert';
import { SignedStatus, WatchList } from '../../src/types';

const SIGNED_FILTER_OPTIONS = ['All', 'Signed', 'Unsigned'] as const;
const SORT_OPTIONS = [
  { key: 'surname', label: 'Surname' },
  { key: 'club', label: 'Club' },
] as const;

type SortMode = (typeof SORT_OPTIONS)[number]['key'];

export default function WatchListScreen() {
  const [items, setItems] = useState<WatchList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [signedStatus, setSignedStatus] = useState<(typeof SIGNED_FILTER_OPTIONS)[number]>('All');
  const [draftYear, setDraftYear] = useState<string>('All');
  const [availableDraftYears, setAvailableDraftYears] = useState<string[]>(['All']);
  const [sortBy, setSortBy] = useState<SortMode>('surname');
  const [exporting, setExporting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WatchList | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSignedStatus, setEditSignedStatus] = useState<SignedStatus>('Unsigned');
  const [editTeams, setEditTeams] = useState<string[]>([]);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (signedStatus !== 'All') params.set('signedStatus', signedStatus);
    if (draftYear !== 'All') params.set('draftYear', draftYear);
    params.set('sortBy', sortBy);
    const query = params.toString();
    return query ? `?${query}` : '';
  }, [draftYear, search, signedStatus, sortBy]);

  const load = useCallback(async () => {
    try {
      const query = buildQueryString();
      const data = await api.get<{ items: WatchList[]; total: number }>(`/api/watch-list${query}`);
      const nextItems = data.items || [];
      setItems(nextItems);

      const nextYears = nextItems
        .map((item) => item.draftYear)
        .filter((value): value is number => typeof value === 'number')
        .map(String);

      if (nextYears.length > 0) {
        setAvailableDraftYears((prev) => {
          const merged = Array.from(new Set([...prev.filter((year) => year !== 'All'), ...nextYears])).sort(
            (a, b) => Number(a) - Number(b)
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

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const draftYearOptions = useMemo(() => {
    if (draftYear === 'All' || availableDraftYears.includes(draftYear)) {
      return availableDraftYears;
    }

    const merged = Array.from(new Set([...availableDraftYears.filter((year) => year !== 'All'), draftYear])).sort(
      (a, b) => Number(a) - Number(b)
    );

    return ['All', ...merged];
  }, [availableDraftYears, draftYear]);

  const startEdit = (item: WatchList) => {
    setEditingItem(item);
    setEditSignedStatus(item.signedStatus || 'Unsigned');
    setEditTeams(item.aflTeamsInterested || []);
    setEditOpen(true);
  };

  const toggleTeam = (team: string) => {
    setEditTeams((prev) => (prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]));
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      setSavingEdit(true);
      const updated = await api.patch<WatchList>(`/api/watch-list/${editingItem.id}`, {
        signedStatus: editSignedStatus,
        aflTeamsInterested: editTeams,
      });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditOpen(false);
      setEditingItem(null);
      showAlert('Success', 'Watch list entry updated.');
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to update watch list entry');
    } finally {
      setSavingEdit(false);
    }
  };

  const exportExcel = async () => {
    try {
      setExporting(true);
      const token = await getToken();
      const query = buildQueryString();
      const res = await fetch(`${api.baseUrl}/api/watch-list/export${query}`, {
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

  const clearFilters = () => {
    setSearch('');
    setSignedStatus('All');
    setDraftYear('All');
    setSortBy('surname');
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterWrap}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by player name"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
        </View>

        <Text style={styles.filterLabel}>Draft Year</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.draftYearTabsRow}>
          {draftYearOptions.map((year) => {
            const isActive = draftYear === year;
            return (
              <TouchableOpacity
                key={year}
                style={[styles.draftYearTab, isActive && styles.draftYearTabActive]}
                onPress={() => setDraftYear(year)}
              >
                <Text style={[styles.draftYearTabText, isActive && styles.draftYearTabTextActive]}>{year}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.filterLabel}>Signed Status</Text>
        <View style={styles.filterTabsRow}>
          {SIGNED_FILTER_OPTIONS.map((option) => {
            const isActive = signedStatus === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setSignedStatus(option)}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.filterLabel}>Sort By</Text>
        <View style={styles.inlineRow}>
          {SORT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[styles.chip, sortBy === option.key && styles.chipActive]}
              onPress={() => setSortBy(option.key)}
            >
              <Text style={[styles.chipText, sortBy === option.key && styles.chipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.topActions}>
          <Text style={styles.countText}>{items.length} players in watch list</Text>
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearText}>Clear filters</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.exportBtn, exporting && styles.disabled]}
          onPress={exportExcel}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={styles.exportBtnText}>Export to Excel</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon="eye-outline" message="No players in watch list yet" />
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 32 }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.table}>
              <View style={[styles.row, styles.headerRow]}>
                <Text style={[styles.cell, styles.headerCell, styles.nameCol]}>Player Name</Text>
                <Text style={[styles.cell, styles.headerCell, styles.clubCol]}>Club</Text>
                <Text style={[styles.cell, styles.headerCell, styles.yearCol]}>Draft Year</Text>
                <Text style={[styles.cell, styles.headerCell, styles.statusCol]}>Signed Status</Text>
                <Text style={[styles.cell, styles.headerCell, styles.teamsCol]}>AFL Teams Interested</Text>
                <Text style={[styles.cell, styles.headerCell, styles.actionCol]}>Action</Text>
              </View>

              {items.map((item) => (
                <View key={item.id} style={styles.row}>
                  <Text style={[styles.cell, styles.nameCol]}>{item.player?.fullName || '—'}</Text>
                  <Text style={[styles.cell, styles.clubCol]}>{item.player?.team || '—'}</Text>
                  <Text style={[styles.cell, styles.yearCol]}>{item.draftYear || '—'}</Text>
                  <Text style={[styles.cell, styles.statusCol]}>{item.signedStatus}</Text>
                  <Text style={[styles.cell, styles.teamsCol]} numberOfLines={2}>
                    {(item.aflTeamsInterested || []).join(', ') || '—'}
                  </Text>
                  <View style={[styles.cell, styles.actionCol]}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(item)}>
                      <Ionicons name="create-outline" size={14} color={Colors.accent} />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      )}

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Watch List</Text>
            <Text style={styles.modalSubtitle}>{editingItem?.player?.fullName}</Text>

            <Text style={styles.modalSectionTitle}>Signed Status</Text>
            <View style={styles.inlineRow}>
              {(['Signed', 'Unsigned'] as SignedStatus[]).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.chip, editSignedStatus === status && styles.chipActive]}
                  onPress={() => setEditSignedStatus(status)}
                >
                  <Text style={[styles.chipText, editSignedStatus === status && styles.chipTextActive]}>{status}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalSectionTitle}>AFL Teams Interested</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              <View style={styles.teamsWrap}>
                {AFL_TEAMS.map((team) => {
                  const selected = editTeams.includes(team);
                  return (
                    <TouchableOpacity
                      key={team}
                      style={[styles.teamChip, selected && styles.teamChipSelected]}
                      onPress={() => toggleTeam(team)}
                    >
                      <Text style={[styles.teamChipText, selected && styles.teamChipTextSelected]}>{team}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <GradientButton title="Save" onPress={saveEdit} loading={savingEdit} style={{ marginTop: 16 }} />
            <TouchableOpacity style={styles.modalCancel} onPress={() => setEditOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  draftYearTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 4,
  },
  draftYearTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  draftYearTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  draftYearTabText: {
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  draftYearTabTextActive: {
    color: '#fff',
  },
  inlineRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterTabsRow: { flexDirection: 'row', gap: 8 },
  filterTab: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTabText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 13 },
  filterTabTextActive: { color: '#fff' },
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
  topActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  countText: { color: Colors.textMuted, fontSize: 12 },
  clearText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  exportBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  exportBtnText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.7 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerRow: { backgroundColor: Colors.elevated },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  headerCell: { color: Colors.text, fontWeight: '700' },
  nameCol: { width: 180 },
  clubCol: { width: 130 },
  yearCol: { width: 90 },
  statusCol: { width: 110 },
  teamsCol: { width: 260 },
  actionCol: { width: 90, alignItems: 'center', justifyContent: 'center' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(6,182,212,0.12)',
  },
  editBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 12 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  modalSubtitle: { color: Colors.textSecondary, marginTop: 4, marginBottom: 12 },
  modalSectionTitle: { color: Colors.text, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  teamsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  teamChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  teamChipSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  teamChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  teamChipTextSelected: { color: '#fff' },
  modalCancel: { alignItems: 'center', marginTop: 10 },
  modalCancelText: { color: Colors.textSecondary, fontWeight: '600' },
});
