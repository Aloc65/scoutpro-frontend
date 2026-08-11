import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  useWindowDimensions, Image, Modal, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api/client';
import { Colors } from '../../src/theme/colors';
import Card from '../../src/components/Card';
import { Ionicons } from '@expo/vector-icons';
import { showAlert, showConfirm } from '../../src/utils/alert';
import {
  getWeeklyWatchPlan, getWatchPlanCandidates, addWatchPlanEntry,
  updateWatchPlanEntry, removeWatchPlanEntry, autoPopulateWatchPlan, clearWatchPlan,
} from '../../src/api/weeklyWatchPlan';
import {
  WeeklyWatchPlan, WeeklyWatchPlanEntry, WeeklyWatchPlanCandidate, WeeklyWatchPlanGame,
  AUSTRALIAN_STATES, AustralianState,
} from '../../src/types';

interface ScoutOption { id: string; name: string; }

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export default function WeeklyWatchPlanScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [plan, setPlan] = useState<WeeklyWatchPlan | null>(null);
  const [candidates, setCandidates] = useState<WeeklyWatchPlanCandidate[]>([]);
  const [scouts, setScouts] = useState<ScoutOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [onlyPlaying, setOnlyPlaying] = useState(false);
  // State-based filter: null = all states. Defaults to the admin's home state.
  const [selectedState, setSelectedState] = useState<AustralianState | null>(
    (user?.homeState as AustralianState) ?? null,
  );

  // Edit modal
  const [editEntry, setEditEntry] = useState<WeeklyWatchPlanEntry | null>(null);
  const [editFixtureId, setEditFixtureId] = useState<string | null>(null);
  const [editScoutId, setEditScoutId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    try {
      const [planData, candData] = await Promise.all([
        getWeeklyWatchPlan(),
        getWatchPlanCandidates(),
      ]);
      setPlan(planData);
      setCandidates(candData.candidates);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to load weekly watch plan');
    }
  }, []);

  const loadScouts = useCallback(async () => {
    try {
      const res = await api.get<{ users: { id: string; name: string; role: string }[] }>(
        '/api/users?ndaStatus=all&activeStatus=active',
      );
      setScouts(res.users.map((u) => ({ id: u.id, name: u.name })));
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      await Promise.all([load(), loadScouts()]);
      setLoading(false);
    })();
  }, [isAdmin, load, loadScouts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAdd = async (c: WeeklyWatchPlanCandidate) => {
    try {
      setBusy(true);
      await addWatchPlanEntry({ playerId: c.playerId });
      await load();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to add player');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = (entry: WeeklyWatchPlanEntry) => {
    showConfirm('Remove Player', `Remove ${entry.playerName} from this week's plan?`, async () => {
      try {
        setBusy(true);
        await removeWatchPlanEntry(entry.id);
        await load();
      } catch (e: any) {
        showAlert('Error', e.message || 'Failed to remove player');
      } finally {
        setBusy(false);
      }
    });
  };

  const handleAutoPopulate = async () => {
    try {
      setBusy(true);
      const res = await autoPopulateWatchPlan(selectedState ?? undefined);
      await load();
      const scope = selectedState ? ` in ${selectedState}` : '';
      showAlert('Auto-populate', `Added ${res.added} player${res.added === 1 ? '' : 's'}${scope} whose team plays this weekend.`);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to auto-populate');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = () => {
    if (!plan || plan.entries.length === 0) return;
    showConfirm('Clear Plan', `Remove all ${plan.entries.length} players from this week's plan?`, async () => {
      try {
        setBusy(true);
        await clearWatchPlan();
        await load();
      } catch (e: any) {
        showAlert('Error', e.message || 'Failed to clear plan');
      } finally {
        setBusy(false);
      }
    });
  };

  const openEdit = (entry: WeeklyWatchPlanEntry) => {
    setEditEntry(entry);
    setEditFixtureId(entry.fixtureId);
    setEditScoutId(entry.assignedScoutId);
    setEditNotes(entry.notes ?? '');
  };

  const closeEdit = () => {
    setEditEntry(null);
    setEditFixtureId(null);
    setEditScoutId(null);
    setEditNotes('');
  };

  const saveEdit = async () => {
    if (!editEntry) return;
    try {
      setSavingEdit(true);
      await updateWatchPlanEntry(editEntry.id, {
        fixtureId: editFixtureId ?? '',
        assignedScoutId: editScoutId ?? '',
        notes: editNotes.trim(),
      });
      closeEdit();
      await load();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save changes');
    } finally {
      setSavingEdit(false);
    }
  };

  if (!isAdmin) {
    return (
      <View style={styles.centerContainer}>
        <Card style={styles.msgCard}>
          <Ionicons name="lock-closed" size={48} color={Colors.textMuted} />
          <Text style={styles.msgTitle}>Admin Only</Text>
          <Text style={styles.msgSub}>The Weekly Watch Plan is managed by administrators.</Text>
        </Card>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  const filteredCandidates = candidates.filter(
    (c) =>
      (!onlyPlaying || c.playsThisWeekend) &&
      (!selectedState || c.state === selectedState),
  );
  const filteredEntries = (plan?.entries ?? []).filter(
    (e) => !selectedState || e.state === selectedState,
  );
  const games: WeeklyWatchPlanGame[] = plan?.games ?? [];

  const renderPhoto = (photoUrl: string | null, name: string, size = 44) => (
    photoUrl ? (
      <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    ) : (
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.avatarText}>{initials(name)}</Text>
      </View>
    )
  );

  const renderEntry = (entry: WeeklyWatchPlanEntry) => (
    <Card key={entry.id} style={[styles.entryCard, isWide && styles.entryCardWide]}>
      <View style={styles.entryTop}>
        {renderPhoto(entry.photoUrl, entry.playerName)}
        <View style={styles.entryInfo}>
          <Text style={styles.entryName} numberOfLines={1}>{entry.playerName}</Text>
          <Text style={styles.entryMeta} numberOfLines={1}>
            {[entry.team, entry.position, entry.draftYear ? `'${String(entry.draftYear).slice(-2)}` : null]
              .filter(Boolean).join(' · ') || '—'}
          </Text>
        </View>
        <View style={styles.entryActions}>
          <TouchableOpacity onPress={() => openEdit(entry)} style={styles.iconBtn} accessibilityLabel="Edit">
            <Ionicons name="create-outline" size={20} color={Colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleRemove(entry)} style={styles.iconBtn} accessibilityLabel="Remove">
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      {(entry.fixtureLabel || entry.assignedScoutName || entry.notes) && (
        <View style={styles.entryDetails}>
          {entry.fixtureLabel && (
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.detailText} numberOfLines={1}>
                {entry.fixtureLabel}{entry.fixtureDate ? ` · ${entry.fixtureDate}` : ''}
              </Text>
            </View>
          )}
          {entry.assignedScoutName && (
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.detailText} numberOfLines={1}>{entry.assignedScoutName}</Text>
            </View>
          )}
          {entry.notes ? (
            <View style={styles.detailRow}>
              <Ionicons name="document-text-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.detailText} numberOfLines={2}>{entry.notes}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );

  const renderCandidate = (c: WeeklyWatchPlanCandidate) => (
    <Card key={c.playerId} style={[styles.candCard, isWide && styles.candCardWide]}>
      <View style={styles.candTop}>
        {renderPhoto(c.photoUrl, c.playerName, 40)}
        <View style={styles.entryInfo}>
          <View style={styles.candNameRow}>
            <Text style={styles.entryName} numberOfLines={1}>{c.playerName}</Text>
            {c.playsThisWeekend && (
              <View style={styles.playingBadge}>
                <Text style={styles.playingBadgeText}>Plays</Text>
              </View>
            )}
          </View>
          <Text style={styles.entryMeta} numberOfLines={1}>
            {[c.team, c.position, c.state].filter(Boolean).join(' · ') || '—'}
          </Text>
          {c.aflInterestClub ? (
            <Text style={styles.candInterest} numberOfLines={1}>AFL interest: {c.aflInterestClub}</Text>
          ) : null}
        </View>
        {c.inPlan ? (
          <View style={styles.addedChip}>
            <Ionicons name="checkmark" size={16} color={Colors.green} />
            <Text style={styles.addedChipText}>Added</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => handleAdd(c)}
            disabled={busy}
            accessibilityLabel={`Add ${c.playerName}`}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="star" size={22} color={Colors.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Weekly Watch Plan</Text>
            <Text style={styles.subtitle}>{plan?.weekendLabel || 'This weekend'}</Text>
          </View>
        </View>

        {/* State filter */}
        <View style={styles.stateFilterWrap}>
          <Text style={styles.stateFilterLabel}>State</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stateChips}
          >
            <TouchableOpacity
              style={[styles.stateChip, !selectedState && styles.stateChipActive]}
              onPress={() => setSelectedState(null)}
            >
              <Text style={[styles.stateChipText, !selectedState && styles.stateChipTextActive]}>All</Text>
            </TouchableOpacity>
            {AUSTRALIAN_STATES.map((s) => {
              const active = selectedState === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.stateChip, active && styles.stateChipActive]}
                  onPress={() => setSelectedState(s)}
                >
                  <Text style={[styles.stateChipText, active && styles.stateChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Action bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleAutoPopulate} disabled={busy}>
            <Ionicons name="flash-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Auto-populate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnSecondary]}
            onPress={handleClear}
            disabled={busy || !plan || plan.entries.length === 0}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
            <Text style={[styles.actionBtnText, { color: Colors.error }]}>Clear plan</Text>
          </TouchableOpacity>
        </View>

        {/* Current plan */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>This Week's Plan</Text>
          <View style={styles.countChip}><Text style={styles.countChipText}>{filteredEntries.length}</Text></View>
        </View>
        {filteredEntries.length > 0 ? (
          <View style={isWide ? styles.grid : undefined}>
            {filteredEntries.map(renderEntry)}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="clipboard-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {selectedState ? `No players selected in ${selectedState} yet.` : 'No players selected yet.'}
            </Text>
            <Text style={styles.emptySub}>Use “Auto-populate” or add players from the list below.</Text>
          </Card>
        )}

        {/* Add players */}
        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <Text style={styles.sectionTitle}>Add Players</Text>
          <TouchableOpacity
            style={[styles.filterChip, onlyPlaying && styles.filterChipActive]}
            onPress={() => setOnlyPlaying((v) => !v)}
          >
            <Ionicons
              name={onlyPlaying ? 'checkbox' : 'square-outline'}
              size={16}
              color={onlyPlaying ? Colors.accent : Colors.textMuted}
            />
            <Text style={[styles.filterChipText, onlyPlaying && styles.filterChipTextActive]}>Playing this weekend</Text>
          </TouchableOpacity>
        </View>
        {filteredCandidates.length > 0 ? (
          <View style={isWide ? styles.grid : undefined}>
            {filteredCandidates.map(renderCandidate)}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="people-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {onlyPlaying ? 'No watch-list players playing this weekend.' : 'No watch-list players available.'}
            </Text>
          </Card>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={!!editEntry} transparent animationType="slide" onRequestClose={closeEdit}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit · {editEntry?.playerName}</Text>
                <TouchableOpacity onPress={closeEdit} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Fixture */}
              <Text style={styles.label}>Game</Text>
              <View style={styles.optionList}>
                <TouchableOpacity
                  style={[styles.optionRow, !editFixtureId && styles.optionRowActive]}
                  onPress={() => setEditFixtureId(null)}
                >
                  <Text style={[styles.optionText, !editFixtureId && styles.optionTextActive]}>No specific game</Text>
                  {!editFixtureId && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                </TouchableOpacity>
                {games.map((g) => {
                  const active = editFixtureId === g.id;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                      onPress={() => setEditFixtureId(g.id)}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={1}>
                        {g.homeTeam} v {g.awayTeam}  ·  {g.date}
                      </Text>
                      {active && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                    </TouchableOpacity>
                  );
                })}
                {games.length === 0 && <Text style={styles.helperText}>No fixtures scheduled this weekend.</Text>}
              </View>

              {/* Scout */}
              <Text style={styles.label}>Assigned Scout</Text>
              <View style={styles.optionList}>
                <TouchableOpacity
                  style={[styles.optionRow, !editScoutId && styles.optionRowActive]}
                  onPress={() => setEditScoutId(null)}
                >
                  <Text style={[styles.optionText, !editScoutId && styles.optionTextActive]}>Unassigned</Text>
                  {!editScoutId && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                </TouchableOpacity>
                {scouts.map((s) => {
                  const active = editScoutId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                      onPress={() => setEditScoutId(s.id)}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={1}>{s.name}</Text>
                      {active && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Notes */}
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="What to focus on for this player…"
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={[styles.saveButton, savingEdit && styles.saveButtonDisabled]}
                onPress={saveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  centerContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msgCard: { alignItems: 'center', padding: 32, gap: 8 },
  msgTitle: { color: Colors.text, fontSize: 20, fontWeight: '700', marginTop: 12 },
  msgSub: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  headerIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(245, 158, 11, 0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  title: { color: Colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: 2 },

  stateFilterWrap: { marginBottom: 16 },
  stateFilterLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  stateChips: { gap: 8, paddingRight: 8 },
  stateChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceHigh,
  },
  stateChipActive: { borderColor: Colors.accent, backgroundColor: 'rgba(59, 130, 246, 0.14)' },
  stateChipText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  stateChipTextActive: { color: Colors.accent },

  actionBar: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary,
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10,
  },
  actionBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  countChip: {
    minWidth: 26, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: Colors.surfaceHigh,
    justifyContent: 'center', alignItems: 'center',
  },
  countChipText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 13 },

  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { borderColor: Colors.accent, backgroundColor: 'rgba(59, 130, 246, 0.1)' },
  filterChipText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: Colors.accent },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  entryCard: { marginBottom: 12, gap: 10 },
  entryCardWide: { width: '48.5%', marginBottom: 0 },
  entryTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entryInfo: { flex: 1, minWidth: 0 },
  entryName: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  entryMeta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  entryActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 6, borderRadius: 8 },
  entryDetails: { gap: 6, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { color: Colors.textSecondary, fontSize: 13, flex: 1 },

  avatar: { backgroundColor: Colors.surfaceHigh, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },

  candCard: { marginBottom: 12 },
  candCardWide: { width: '48.5%', marginBottom: 0 },
  candTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  candNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  candInterest: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  playingBadge: { backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  playingBadgeText: { color: Colors.green, fontSize: 11, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  addedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  addedChipText: { color: Colors.green, fontWeight: '700', fontSize: 13 },

  emptyCard: { alignItems: 'center', padding: 28, gap: 6 },
  emptyText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  emptySub: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, flex: 1 },
  closeBtn: { padding: 4 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  optionList: { gap: 6 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.elevated, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: Colors.border,
  },
  optionRowActive: { borderColor: Colors.accent, backgroundColor: 'rgba(59, 130, 246, 0.1)' },
  optionText: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  optionTextActive: { color: Colors.text, fontWeight: '600' },
  helperText: { color: Colors.textMuted, fontSize: 12 },
  input: {
    backgroundColor: Colors.elevated, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: {
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 24, marginBottom: 20,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
