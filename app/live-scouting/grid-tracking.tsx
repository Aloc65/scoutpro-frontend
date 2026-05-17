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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import {
  liveScoutingApi,
  LiveScoutingSession,
  TRAITS,
} from '../../src/api/liveScouting';

const QUARTERS = [1, 2, 3, 4];

export default function GridTrackingScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<LiveScoutingSession | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => { loadSession(); }, [loadSession]);

  if (loading || !session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading grid view...</Text>
      </View>
    );
  }

  const players = session.sessionPlayers;

  const handleStatUpdate = async (playerId: string, field: string, delta: number) => {
    if (!sessionId || updating) return;
    const key = `${playerId}-${field}-${delta}`;
    setUpdating(key);
    try {
      const updatedQD = await liveScoutingApi.updateStats(sessionId, playerId, activeQuarter, field, delta);
      setSession((prev) => {
        if (!prev) return prev;
        const newPlayers = prev.sessionPlayers.map((sp) => {
          if (sp.playerId !== playerId) return sp;
          const newQD = sp.quarterData.map((q) =>
            q.quarter === activeQuarter ? { ...q, ...updatedQD } : q,
          );
          if (!sp.quarterData.find((q) => q.quarter === activeQuarter)) newQD.push(updatedQD);
          return { ...sp, quarterData: newQD };
        });
        return { ...prev, sessionPlayers: newPlayers };
      });
    } catch (err: any) {
      console.error('Grid stat update failed:', err);
    } finally {
      setUpdating(null);
    }
  };

  const getVal = (sp: any, field: string): number => {
    const qd = sp.quarterData.find((q: any) => q.quarter === activeQuarter);
    if (!qd) return 0;
    return (qd as any)[field] || 0;
  };

  const getRating = (sp: any, ratingKey: string): number | null => {
    const qd = sp.quarterData.find((q: any) => q.quarter === activeQuarter);
    if (!qd) return null;
    return (qd as any)[ratingKey] ?? null;
  };

  const allTraitRows = [
    { key: 'goals', label: '⚽ Goals', ratingKey: null },
    ...TRAITS.map((t) => ({ key: t.key, label: `${t.icon} ${t.label}`, ratingKey: t.ratingKey })),
  ];

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.gameTitle}>{session.gameTitle}</Text>
          <Text style={styles.gameMeta}>{session.competition || ''} • Grid View</Text>
        </View>
        <TouchableOpacity
          style={styles.switchBtn}
          onPress={() => router.replace(`/live-scouting/tracking?sessionId=${sessionId}` as any)}
        >
          <Ionicons name="phone-portrait-outline" size={16} color={Colors.accent} />
          <Text style={styles.switchText}>Mobile</Text>
        </TouchableOpacity>
      </View>

      {/* Quarter tabs */}
      <View style={styles.quarterRow}>
        {QUARTERS.map((q) => (
          <TouchableOpacity
            key={q}
            style={[styles.qTab, activeQuarter === q && styles.qTabActive]}
            onPress={() => setActiveQuarter(q)}
          >
            <Text style={[styles.qTabText, activeQuarter === q && styles.qTabTextActive]}>Q{q}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.summaryBtn}
          onPress={() => router.push(`/live-scouting/session-summary?sessionId=${sessionId}` as any)}
        >
          <Ionicons name="bar-chart-outline" size={16} color={Colors.green} />
          <Text style={styles.summaryText}>Summary</Text>
        </TouchableOpacity>
      </View>

      {/* Spreadsheet grid */}
      <ScrollView horizontal style={styles.gridScrollH}>
        <ScrollView style={styles.gridScrollV} contentContainerStyle={styles.gridContent}>
          {/* Header row: player names */}
          <View style={styles.gridRow}>
            <View style={styles.gridLabelCell}>
              <Text style={styles.gridLabelText}>Trait</Text>
            </View>
            {players.map((sp) => (
              <View key={sp.id} style={styles.gridHeaderCell}>
                <Text style={styles.gridPlayerName} numberOfLines={1}>
                  {sp.player.fullName.split(' ').pop()}
                </Text>
                <Text style={styles.gridPlayerPos}>{sp.position || ''}</Text>
                {sp.isNewPlayer && (
                  <View style={styles.gridNewBadge}>
                    <Text style={styles.gridNewText}>NEW</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Data rows */}
          {allTraitRows.map((trait, idx) => (
            <View key={trait.key} style={[styles.gridRow, idx % 2 === 0 ? styles.gridRowEven : null]}>
              <View style={styles.gridLabelCell}>
                <Text style={styles.gridTraitLabel}>{trait.label}</Text>
              </View>
              {players.map((sp) => {
                const val = getVal(sp, trait.key);
                const rating = trait.ratingKey ? getRating(sp, trait.ratingKey) : null;
                return (
                  <View key={sp.id} style={styles.gridDataCell}>
                    <View style={styles.gridCellRow}>
                      <TouchableOpacity
                        style={styles.gridMinus}
                        onPress={() => handleStatUpdate(sp.playerId, trait.key, -1)}
                        disabled={!!updating}
                      >
                        <Text style={styles.gridMinusText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.gridCellValue}>{val}</Text>
                      <TouchableOpacity
                        style={styles.gridPlus}
                        onPress={() => handleStatUpdate(sp.playerId, trait.key, 1)}
                        disabled={!!updating}
                      >
                        <Text style={styles.gridPlusText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    {rating != null && (
                      <Text style={[styles.gridRating, { color: rating >= 4 ? Colors.green : rating <= 2 ? Colors.error : Colors.amber }]}>
                        ★{rating}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          {/* Notes row */}
          <View style={styles.gridRow}>
            <View style={styles.gridLabelCell}>
              <Text style={styles.gridTraitLabel}>📝 Notes</Text>
            </View>
            {players.map((sp) => {
              const qd = sp.quarterData.find((q) => q.quarter === activeQuarter);
              return (
                <TouchableOpacity
                  key={sp.id}
                  style={styles.gridNotesCell}
                  onPress={() =>
                    router.push(
                      `/live-scouting/notes?sessionId=${sessionId}&playerId=${sp.playerId}&quarter=${activeQuarter}` as any,
                    )
                  }
                >
                  <Text style={styles.gridNotesText} numberOfLines={2}>
                    {qd?.notes || 'Tap to add...'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Review row */}
          <View style={styles.gridRow}>
            <View style={styles.gridLabelCell}>
              <Text style={styles.gridTraitLabel}>⭐ Review</Text>
            </View>
            {players.map((sp) => {
              const qd = sp.quarterData.find((q) => q.quarter === activeQuarter);
              return (
                <TouchableOpacity
                  key={sp.id}
                  style={styles.gridReviewCell}
                  onPress={() =>
                    router.push(
                      `/live-scouting/quarter-review?sessionId=${sessionId}&playerId=${sp.playerId}&quarter=${activeQuarter}` as any,
                    )
                  }
                >
                  <Ionicons
                    name={qd?.reviewCompleted ? 'checkmark-circle' : 'star-outline'}
                    size={18}
                    color={qd?.reviewCompleted ? Colors.green : Colors.amber}
                  />
                  <Text style={styles.gridReviewText}>
                    {qd?.reviewCompleted ? 'Done' : 'Rate'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { color: Colors.textSecondary, marginTop: 12 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.elevated, justifyContent: 'center', alignItems: 'center',
  },
  gameTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  gameMeta: { color: Colors.textSecondary, fontSize: 12 },
  switchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.accent, backgroundColor: 'rgba(6,182,212,0.08)',
  },
  switchText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },

  quarterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  qTab: {
    paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8,
    backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border,
  },
  qTabActive: { backgroundColor: 'rgba(79,70,229,0.2)', borderColor: Colors.primary },
  qTabText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  qTabTextActive: { color: Colors.primary },
  summaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: Colors.green,
  },
  summaryText: { color: Colors.green, fontSize: 12, fontWeight: '700' },

  gridScrollH: { flex: 1 },
  gridScrollV: { flex: 1 },
  gridContent: { paddingBottom: 40 },

  gridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  gridRowEven: { backgroundColor: 'rgba(255,255,255,0.02)' },

  gridLabelCell: {
    width: 120, paddingHorizontal: 10, paddingVertical: 10,
    justifyContent: 'center', borderRightWidth: 1, borderRightColor: Colors.border,
    backgroundColor: Colors.card,
  },
  gridLabelText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  gridTraitLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },

  gridHeaderCell: {
    width: 140, paddingHorizontal: 8, paddingVertical: 10,
    alignItems: 'center', borderRightWidth: 1, borderRightColor: Colors.border,
    backgroundColor: Colors.elevated,
  },
  gridPlayerName: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  gridPlayerPos: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  gridNewBadge: { backgroundColor: Colors.green, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginTop: 2 },
  gridNewText: { color: '#fff', fontSize: 7, fontWeight: '800' },

  gridDataCell: {
    width: 140, paddingVertical: 6, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: Colors.border,
  },
  gridCellRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gridMinus: {
    width: 30, height: 30, borderRadius: 6,
    backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  gridMinusText: { fontSize: 18, fontWeight: '700', color: Colors.error },
  gridPlus: {
    width: 30, height: 30, borderRadius: 6,
    backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  gridPlusText: { fontSize: 18, fontWeight: '700', color: Colors.green },
  gridCellValue: { fontSize: 18, fontWeight: '800', color: Colors.text, minWidth: 24, textAlign: 'center' },
  gridRating: { fontSize: 10, fontWeight: '700', marginTop: 2 },

  gridNotesCell: {
    width: 140, paddingHorizontal: 8, paddingVertical: 10,
    justifyContent: 'center', borderRightWidth: 1, borderRightColor: Colors.border,
  },
  gridNotesText: { color: Colors.textMuted, fontSize: 11, fontStyle: 'italic' },

  gridReviewCell: {
    width: 140, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: Colors.border,
  },
  gridReviewText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 2 },
});
