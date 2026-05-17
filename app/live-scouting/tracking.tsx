import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import {
  liveScoutingApi,
  LiveScoutingSession,
  SessionPlayerData,
  QuarterData,
  TRAITS,
} from '../../src/api/liveScouting';

const QUARTERS = [1, 2, 3, 4];

export default function TrackingScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<LiveScoutingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [activeQuarter, setActiveQuarter] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const s = await liveScoutingApi.getSession(sessionId);
      setSession(s);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load session';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (loading || !session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading session...</Text>
      </View>
    );
  }

  const players = session.sessionPlayers;
  if (players.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>No players in session</Text>
      </View>
    );
  }

  const currentPlayer = players[activePlayerIdx] || players[0];
  const currentQD = currentPlayer.quarterData.find((q) => q.quarter === activeQuarter);

  const handleStatUpdate = async (field: string, delta: number) => {
    if (!sessionId || updating) return;
    const updateKey = `${field}-${delta}`;
    setUpdating(updateKey);
    try {
      const updatedQD = await liveScoutingApi.updateStats(
        sessionId,
        currentPlayer.playerId,
        activeQuarter,
        field,
        delta,
      );
      // Update local state
      setSession((prev) => {
        if (!prev) return prev;
        const newPlayers = prev.sessionPlayers.map((sp) => {
          if (sp.playerId !== currentPlayer.playerId) return sp;
          const newQD = sp.quarterData.map((q) =>
            q.quarter === activeQuarter ? { ...q, ...updatedQD } : q,
          );
          // If quarter didn't exist yet, add it
          if (!sp.quarterData.find((q) => q.quarter === activeQuarter)) {
            newQD.push(updatedQD);
          }
          return { ...sp, quarterData: newQD };
        });
        return { ...prev, sessionPlayers: newPlayers };
      });
    } catch (err: any) {
      console.error('Stat update failed:', err);
    } finally {
      setUpdating(null);
    }
  };

  const goToReview = () => {
    router.push(
      `/live-scouting/quarter-review?sessionId=${sessionId}&playerId=${currentPlayer.playerId}&quarter=${activeQuarter}` as any,
    );
  };

  const goToNotes = () => {
    router.push(
      `/live-scouting/notes?sessionId=${sessionId}&playerId=${currentPlayer.playerId}&quarter=${activeQuarter}` as any,
    );
  };

  const goToSummary = () => {
    router.push(`/live-scouting/session-summary?sessionId=${sessionId}` as any);
  };

  const getValue = (field: string): number => {
    if (!currentQD) return 0;
    return (currentQD as any)[field] || 0;
  };

  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 768;

  // Auto-redirect to grid view on wide screens
  useEffect(() => {
    if (isWide && session && session.sessionPlayers.length > 1) {
      // On tablets/desktop, suggest grid view
    }
  }, [isWide, session]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Game header */}
      <View style={styles.gameHeader}>
        <Text style={styles.gameTitle}>{session.gameTitle}</Text>
        <Text style={styles.gameMeta}>
          {session.competition ? `${session.competition} · ` : ''}
          {session.venue || 'No venue'}
        </Text>
        {/* Grid view switch for wider screens */}
        {players.length > 1 && (
          <TouchableOpacity
            style={styles.gridSwitchBtn}
            onPress={() => router.replace(`/live-scouting/grid-tracking?sessionId=${sessionId}` as any)}
          >
            <Ionicons name="grid-outline" size={16} color={Colors.accent} />
            <Text style={styles.gridSwitchText}>{isWide ? 'Grid View (Recommended)' : 'Grid View'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Player tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerTabs}>
        {players.map((sp, idx) => (
          <TouchableOpacity
            key={sp.id}
            style={[styles.playerTab, activePlayerIdx === idx && styles.playerTabActive]}
            onPress={() => setActivePlayerIdx(idx)}
          >
            <Text style={[styles.playerTabText, activePlayerIdx === idx && styles.playerTabTextActive]}>
              {sp.player.fullName.split(' ').pop()}
            </Text>
            {sp.isNewPlayer && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Player info */}
      <View style={styles.playerHeader}>
        <Text style={styles.playerName}>{currentPlayer.player.fullName}</Text>
        <Text style={styles.playerInfo}>
          {[currentPlayer.position, currentPlayer.player.team, currentPlayer.player.draftYear ? `Draft ${currentPlayer.player.draftYear}` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      {/* Quarter tabs */}
      <View style={styles.quarterRow}>
        {QUARTERS.map((q) => {
          const qd = currentPlayer.quarterData.find((qd) => qd.quarter === q);
          const hasData = qd && (qd.goals > 0 || qd.kickCount > 0 || qd.handballCount > 0);
          return (
            <TouchableOpacity
              key={q}
              style={[styles.quarterTab, activeQuarter === q && styles.quarterTabActive]}
              onPress={() => setActiveQuarter(q)}
            >
              <Text style={[styles.quarterTabText, activeQuarter === q && styles.quarterTabTextActive]}>Q{q}</Text>
              {hasData && <View style={styles.quarterDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Goals counter */}
      <View style={styles.goalsCard}>
        <Text style={styles.goalsLabel}>⚽ Goals</Text>
        <View style={styles.counterRow}>
          <TouchableOpacity
            style={styles.counterBtnMinus}
            onPress={() => handleStatUpdate('goals', -1)}
            disabled={!!updating}
          >
            <Text style={styles.counterBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.goalsValue}>{getValue('goals')}</Text>
          <TouchableOpacity
            style={styles.counterBtnPlus}
            onPress={() => handleStatUpdate('goals', 1)}
            disabled={!!updating}
          >
            <Text style={styles.counterBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Traits grid */}
      <View style={styles.traitsGrid}>
        {TRAITS.map((trait) => (
          <View key={trait.key} style={styles.traitCard}>
            <Text style={styles.traitLabel}>
              {trait.icon} {trait.label}
            </Text>
            <View style={styles.traitCounterRow}>
              <TouchableOpacity
                style={styles.traitBtnMinus}
                onPress={() => handleStatUpdate(trait.key, -1)}
                disabled={!!updating}
              >
                <Text style={styles.traitBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.traitValue}>{getValue(trait.key)}</Text>
              <TouchableOpacity
                style={styles.traitBtnPlus}
                onPress={() => handleStatUpdate(trait.key, 1)}
                disabled={!!updating}
              >
                <Text style={styles.traitBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.notesBtn} onPress={goToNotes}>
          <Ionicons name="create-outline" size={18} color={Colors.accent} />
          <Text style={styles.notesBtnText}>Notes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reviewBtn} onPress={goToReview}>
          <Ionicons name="star-outline" size={18} color={Colors.amber} />
          <Text style={styles.reviewBtnText}>End Quarter Review</Text>
        </TouchableOpacity>
      </View>

      {/* Complete session */}
      <TouchableOpacity style={styles.completeBtn} onPress={goToSummary}>
        <Ionicons name="checkmark-done" size={18} color="#fff" />
        <Text style={styles.completeBtnText}>View Session Summary</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { color: Colors.textSecondary, marginTop: 12, fontSize: 14 },

  gameHeader: { alignItems: 'center', marginBottom: 12 },
  gameTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  gameMeta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  gridSwitchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.accent,
    backgroundColor: 'rgba(6,182,212,0.08)', marginTop: 8,
  },
  gridSwitchText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },

  playerTabs: { marginBottom: 12, maxHeight: 42 },
  playerTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.elevated,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerTabActive: { backgroundColor: 'rgba(6,182,212,0.2)', borderWidth: 1, borderColor: Colors.accent },
  playerTabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  playerTabTextActive: { color: Colors.accent },
  newBadge: { backgroundColor: Colors.green, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  newBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },

  playerHeader: { alignItems: 'center', marginBottom: 16 },
  playerName: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  playerInfo: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },

  quarterRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  quarterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  quarterTabActive: { backgroundColor: 'rgba(79,70,229,0.2)', borderColor: Colors.primary },
  quarterTabText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  quarterTabTextActive: { color: Colors.primary },
  quarterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.green,
    marginTop: 4,
  },

  // Goals
  goalsCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginBottom: 16,
  },
  goalsLabel: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  counterBtnMinus: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnPlus: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnText: { fontSize: 28, fontWeight: '700', color: Colors.text },
  goalsValue: { fontSize: 36, fontWeight: '800', color: Colors.text, minWidth: 50, textAlign: 'center' },

  // Traits
  traitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  traitCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '48%' as any,
    minWidth: 155,
    flexGrow: 1,
    alignItems: 'center',
  },
  traitLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  traitCounterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  traitBtnMinus: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  traitBtnPlus: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  traitBtnText: { fontSize: 22, fontWeight: '700', color: Colors.text },
  traitValue: { fontSize: 22, fontWeight: '800', color: Colors.text, minWidth: 30, textAlign: 'center' },

  // Actions
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  notesBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: 'rgba(6,182,212,0.08)',
  },
  notesBtnText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  reviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.amber,
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  reviewBtnText: { color: Colors.amber, fontSize: 14, fontWeight: '700' },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
  completeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
