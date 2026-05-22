import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { POSITIONS } from '../../src/types';
import { api } from '../../src/api/client';
import { liveScoutingApi, SessionPlayerData } from '../../src/api/liveScouting';

interface SearchPlayer {
  id: string;
  fullName: string;
  team: string | null;
  draftYear: number | null;
}

export default function AddPlayersScreen() {
  const router = useRouter();
  const { sessionId, from } = useLocalSearchParams<{ sessionId: string; from?: string }>();
  const isMidSession = from === 'tracking';
  const [sessionPlayers, setSessionPlayers] = useState<SessionPlayerData[]>([]);
  const [loading, setLoading] = useState(false);

  // Search state
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchPlayer[]>([]);
  const [searching, setSearching] = useState(false);

  // New player modal
  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [newDraftYear, setNewDraftYear] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newRepTeam, setNewRepTeam] = useState('');

  // Position + representing team picker for existing player
  const [selectedPosition, setSelectedPosition] = useState('');
  const [repTeam, setRepTeam] = useState('');

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const session = await liveScoutingApi.getSession(sessionId);
      setSessionPlayers(session.sessionPlayers);
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Search players
  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.get<{ items: SearchPlayer[]; total: number }>(
          `/api/players?search=${encodeURIComponent(search.trim())}&limit=10`,
        );
        // Filter out already added players
        const addedIds = new Set(sessionPlayers.map((sp) => sp.playerId));
        setSearchResults((results.items || []).filter((p) => !addedIds.has(p.id)));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, sessionPlayers]);

  const addExistingPlayer = async (player: SearchPlayer) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await liveScoutingApi.addPlayer(sessionId, {
        playerId: player.id,
        position: selectedPosition || undefined,
        representingTeam: repTeam.trim() || undefined,
      });
      setSearch('');
      setSearchResults([]);
      setSelectedPosition('');
      setRepTeam('');
      await loadSession();
    } catch (err: any) {
      const msg = err?.message || 'Failed to add player';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const addNewPlayer = async () => {
    if (!sessionId || !newFirst.trim() || !newLast.trim()) return;
    setLoading(true);
    try {
      await liveScoutingApi.addPlayer(sessionId, {
        newPlayerFirstName: newFirst.trim(),
        newPlayerLastName: newLast.trim(),
        newPlayerTeam: newTeam.trim() || undefined,
        newPlayerDraftYear: newDraftYear ? parseInt(newDraftYear) : undefined,
        position: newPosition || undefined,
        representingTeam: newRepTeam.trim() || undefined,
        isNewPlayer: true,
      });
      setShowNewPlayer(false);
      setNewFirst('');
      setNewLast('');
      setNewTeam('');
      setNewDraftYear('');
      setNewPosition('');
      setNewRepTeam('');
      await loadSession();
    } catch (err: any) {
      const msg = err?.message || 'Failed to create player';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const removePlayer = async (playerId: string) => {
    if (!sessionId) return;
    try {
      await liveScoutingApi.removePlayer(sessionId, playerId);
      await loadSession();
    } catch {}
  };

  const startScouting = () => {
    if (sessionPlayers.length === 0) {
      const msg = 'Add at least one player before starting';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Info', msg);
      return;
    }
    if (isMidSession) {
      router.back();
    } else {
      router.replace(`/live-scouting/tracking?sessionId=${sessionId}` as any);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        {isMidSession && (
          <TouchableOpacity
            style={styles.backToTrackingBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={16} color={Colors.accent} />
            <Text style={styles.backToTrackingText}>Back to Tracking</Text>
          </TouchableOpacity>
        )}
        <Ionicons name="people-outline" size={28} color={Colors.accent} />
        <Text style={styles.title}>{isMidSession ? 'Add Player Mid-Game' : 'Add Players to Session'}</Text>
        <Text style={styles.subtitle}>
          {sessionPlayers.length} player{sessionPlayers.length !== 1 ? 's' : ''} added
          {isMidSession ? ' · Session in progress' : ''}
        </Text>
      </View>

      {/* Representing team — always visible session-level setting */}
      <View style={styles.repTeamCard}>
        <View style={styles.repTeamHeader}>
          <Text style={styles.repTeamIcon}>🏟️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.repTeamTitle}>Representing Team</Text>
            <Text style={styles.repTeamDesc}>
              Which team are the players representing in this game?
            </Text>
          </View>
        </View>
        <TextInput
          style={styles.input}
          value={repTeam}
          onChangeText={setRepTeam}
          placeholder="e.g. Western Australia U18s, Aquinas PSA"
          placeholderTextColor={Colors.textMuted}
        />
        <Text style={styles.repTeamHint}>
          Optional — leave blank to use each player's primary club team
        </Text>
      </View>

      {/* Search existing players */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Search Existing Players</Text>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Type player name to search..."
          placeholderTextColor={Colors.textMuted}
        />
        {searching && <ActivityIndicator style={{ marginTop: 8 }} color={Colors.accent} />}

        {/* Position picker for existing players – shown when there are search results */}
        {searchResults.length > 0 && (
          <View style={styles.existingPosSection}>
            <Text style={styles.existingPosLabel}>📍 Select Position Before Adding</Text>
            <View style={styles.posGrid}>
              {POSITIONS.map((pos) => (
                <TouchableOpacity
                  key={pos}
                  style={[styles.posChip, selectedPosition === pos && styles.posChipActive]}
                  onPress={() => setSelectedPosition(selectedPosition === pos ? '' : pos)}
                >
                  <Text style={[styles.posChipText, selectedPosition === pos && styles.posChipTextActive]}>{pos}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedPosition ? (
              <Text style={styles.existingPosSelected}>✓ Position: {selectedPosition}</Text>
            ) : (
              <Text style={styles.existingPosHint}>Tap a position chip, then tap a player to add them</Text>
            )}
          </View>
        )}

        {searchResults.map((p) => (
          <TouchableOpacity key={p.id} style={styles.searchResult} onPress={() => addExistingPlayer(p)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerName}>{p.fullName}</Text>
              <Text style={styles.playerMeta}>
                {[p.team, p.draftYear ? `Draft ${p.draftYear}` : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="add-circle" size={24} color={Colors.green} />
              {selectedPosition ? (
                <Text style={{ color: Colors.accent, fontSize: 9, fontWeight: '700', marginTop: 2 }}>{selectedPosition}</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
        {search.trim().length >= 2 && !searching && searchResults.length === 0 && (
          <Text style={styles.noResults}>No players found</Text>
        )}
      </View>

      {/* Create new player button */}
      <TouchableOpacity style={styles.newPlayerBtn} onPress={() => { setNewRepTeam(repTeam); setShowNewPlayer(true); }}>
        <Ionicons name="person-add-outline" size={20} color={Colors.accent} />
        <Text style={styles.newPlayerBtnText}>Create New Player</Text>
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      </TouchableOpacity>

      {/* Added players list */}
      {sessionPlayers.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Players in Session</Text>
          {sessionPlayers.map((sp) => (
            <View key={sp.id} style={styles.addedPlayer}>
              <View style={{ flex: 1 }}>
                <View style={styles.playerNameRow}>
                  <Text style={styles.playerName}>{sp.player.fullName}</Text>
                  {sp.isNewPlayer && (
                    <View style={styles.newBadgeSm}>
                      <Text style={styles.newBadgeSmText}>NEW</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.playerMeta}>
                  {[sp.position, sp.representingTeam || sp.player.team].filter(Boolean).join(' · ')}
                  {sp.representingTeam && sp.representingTeam !== sp.player.team ? ' 🏟️' : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removePlayer(sp.playerId)}>
                <Ionicons name="close-circle" size={22} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Start / continue scouting button */}
      <TouchableOpacity
        style={[styles.startBtn, sessionPlayers.length === 0 && styles.startBtnDisabled]}
        onPress={startScouting}
      >
        <Ionicons name={isMidSession ? 'arrow-back-circle' : 'play'} size={20} color="#fff" />
        <Text style={styles.startBtnText}>
          {isMidSession ? 'Back to Live Tracking' : 'Start Live Scouting'}
        </Text>
      </TouchableOpacity>

      {/* New Player Modal */}
      <Modal visible={showNewPlayer} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Player</Text>
              <TouchableOpacity onPress={() => setShowNewPlayer(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={styles.input}
              value={newFirst}
              onChangeText={setNewFirst}
              placeholder="First name"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Last Name *</Text>
            <TextInput
              style={styles.input}
              value={newLast}
              onChangeText={setNewLast}
              placeholder="Last name"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Team</Text>
            <TextInput
              style={styles.input}
              value={newTeam}
              onChangeText={setNewTeam}
              placeholder="Team name"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Draft Year</Text>
            <TextInput
              style={styles.input}
              value={newDraftYear}
              onChangeText={setNewDraftYear}
              placeholder="e.g. 2026"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Position</Text>
            <View style={styles.posGrid}>
              {POSITIONS.map((pos) => (
                <TouchableOpacity
                  key={pos}
                  style={[styles.posChip, newPosition === pos && styles.posChipActive]}
                  onPress={() => setNewPosition(newPosition === pos ? '' : pos)}
                >
                  <Text style={[styles.posChipText, newPosition === pos && styles.posChipTextActive]}>{pos}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Representing Team</Text>
            <TextInput
              style={styles.input}
              value={newRepTeam}
              onChangeText={setNewRepTeam}
              placeholder="Team for this game (optional)"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.repTeamHint}>
              e.g. Western Australia U18s, Aquinas PSA
            </Text>

            <TouchableOpacity
              style={[styles.createBtn, (!newFirst.trim() || !newLast.trim()) && styles.createBtnDisabled]}
              onPress={addNewPlayer}
              disabled={!newFirst.trim() || !newLast.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createBtnText}>Add Player to Session</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, maxWidth: 600, alignSelf: 'center', width: '100%' },
  header: { alignItems: 'center', marginBottom: 20, marginTop: 8, width: '100%' },
  backToTrackingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.accent, backgroundColor: 'rgba(6,182,212,0.08)',
    marginBottom: 12,
  },
  backToTrackingText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  title: { color: Colors.text, fontSize: 22, fontWeight: '800', marginTop: 8 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  sectionTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    marginTop: 8,
  },
  noResults: { color: Colors.textMuted, textAlign: 'center', marginTop: 12, fontSize: 13 },
  playerName: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  newPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  newPlayerBtnText: { color: Colors.accent, fontSize: 15, fontWeight: '700' },
  newBadge: {
    backgroundColor: Colors.green,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  newBadgeSm: {
    backgroundColor: Colors.green,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newBadgeSmText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  addedPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.green,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  existingPosSection: {
    backgroundColor: 'rgba(99,102,241,0.08)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
  },
  existingPosLabel: { color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  existingPosSelected: { color: Colors.accent, fontSize: 12, fontWeight: '700', marginTop: 8 },
  existingPosHint: { color: Colors.textMuted, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  repTeamCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    marginBottom: 16,
  },
  repTeamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  repTeamIcon: { fontSize: 24 },
  repTeamTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  repTeamDesc: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  repTeamHint: { color: Colors.textMuted, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  posGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  posChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 52,
    alignItems: 'center',
  },
  posChipActive: { backgroundColor: 'rgba(6,182,212,0.15)', borderColor: Colors.accent },
  posChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  posChipTextActive: { color: Colors.accent },
  createBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
