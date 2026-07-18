import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import {
  liveScoutingApi,
  LiveScoutingSession,
  TRAITS,
  calcTraitRating,
  PlayerStatus,
} from '../../src/api/liveScouting';
import { useLiveGame } from '../../src/context/LiveGameContext';

const QUARTERS = [1, 2, 3, 4];
const LABEL_COL_WIDTH = 130;
const PLAYER_COL_WIDTH = 150;

export default function GridTrackingScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<LiveScoutingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeQuarter, setActiveQuarter] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [injuryModalVisible, setInjuryModalVisible] = useState(false);
  const [injuryTargetPlayerId, setInjuryTargetPlayerId] = useState<string | null>(null);
  const [injuryTargetName, setInjuryTargetName] = useState('');
  const [injuryQuarterPick, setInjuryQuarterPick] = useState<number>(1);
  const [injuryNotesText, setInjuryNotesText] = useState('');

  // Refs for syncing vertical scroll between left (fixed) and right (scrollable) columns
  const leftScrollRef = useRef<ScrollView>(null);
  const rightScrollRef = useRef<ScrollView>(null);
  const scrollingRef = useRef<'left' | 'right' | null>(null);

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

  // Reload session on mount and when returning from add-players screen
  useFocusEffect(
    useCallback(() => { loadSession(); }, [loadSession])
  );

  // Suspend the inactivity auto-logout while a live game is in progress on
  // this screen (only when the session is actually ACTIVE).
  const { setLiveGameActive } = useLiveGame();
  const isGameActive = session?.status === 'ACTIVE';
  useFocusEffect(
    useCallback(() => {
      if (!isGameActive) return;
      setLiveGameActive(true);
      return () => setLiveGameActive(false);
    }, [isGameActive, setLiveGameActive])
  );

  // Sync vertical scroll between left label column and right player columns
  const handleLeftScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (scrollingRef.current === 'right') return;
    scrollingRef.current = 'left';
    const y = e.nativeEvent.contentOffset.y;
    rightScrollRef.current?.scrollTo({ y, animated: false });
    // Clear lock after a frame
    requestAnimationFrame(() => { scrollingRef.current = null; });
  }, []);

  const handleRightScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (scrollingRef.current === 'left') return;
    scrollingRef.current = 'right';
    const y = e.nativeEvent.contentOffset.y;
    leftScrollRef.current?.scrollTo({ y, animated: false });
    requestAnimationFrame(() => { scrollingRef.current = null; });
  }, []);

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

  // ─── Status handlers ────────────────────────────────────────────

  const handleSetDNP = (playerId: string, playerName: string) => {
    const doIt = async () => {
      setStatusUpdating(true);
      try {
        await liveScoutingApi.updatePlayerStatus(sessionId!, playerId, { status: 'DNP' });
        await loadSession();
      } catch (err: any) {
        const msg = err?.message || 'Failed to update status';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      } finally {
        setStatusUpdating(false);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Mark ${playerName} as DNP (Did Not Play)? This will lock all inputs for this player.`)) doIt();
    } else {
      Alert.alert('Confirm DNP', `Mark ${playerName} as DNP (Did Not Play)? This will lock all inputs for this player.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: 'destructive', onPress: doIt },
      ]);
    }
  };

  const handleOpenInjuryModal = (playerId: string, playerName: string) => {
    setInjuryTargetPlayerId(playerId);
    setInjuryTargetName(playerName);
    setInjuryQuarterPick(activeQuarter);
    setInjuryNotesText('');
    setInjuryModalVisible(true);
  };

  const handleConfirmInjury = async () => {
    if (!injuryTargetPlayerId) return;
    setInjuryModalVisible(false);
    setStatusUpdating(true);
    try {
      await liveScoutingApi.updatePlayerStatus(sessionId!, injuryTargetPlayerId, {
        status: 'INJ',
        injuryQuarter: injuryQuarterPick,
        injuryNotes: injuryNotesText.trim() || undefined,
      });
      await loadSession();
    } catch (err: any) {
      const msg = err?.message || 'Failed to update status';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setStatusUpdating(false);
      setInjuryTargetPlayerId(null);
    }
  };

  const handleClearStatus = (playerId: string, playerName: string, currentStatus: string) => {
    const doIt = async () => {
      setStatusUpdating(true);
      try {
        await liveScoutingApi.updatePlayerStatus(sessionId!, playerId, { status: null });
        await loadSession();
      } catch (err: any) {
        const msg = err?.message || 'Failed to clear status';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      } finally {
        setStatusUpdating(false);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Clear ${currentStatus} status for ${playerName}?`)) doIt();
    } else {
      Alert.alert('Clear Status', `Clear ${currentStatus} status for ${playerName}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', onPress: doIt },
      ]);
    }
  };

  // Build rows: scoring rows + trait rows (each trait = 1 row showing +/- for each player)
  const scoringRows = [
    { field: 'goals', label: '⚽ Goals' },
    { field: 'behinds', label: '🥅 Behinds' },
  ];

  /* ────────────────────────────────────────────
   * Render helpers — left (labels) & right (data)
   * ──────────────────────────────────────────── */

  // Build the left label column content (fixed, no horizontal scroll)
  const renderLeftColumn = () => (
    <>
      {/* Header label */}
      <View style={[styles.labelRow, styles.headerLabelRow]}>
        <Text style={styles.gridLabelText}>Trait</Text>
      </View>

      {/* Status row label */}
      <View style={[styles.labelRow, styles.statusLabelRow]}>
        <Text style={styles.gridTraitLabel}>🏥 Status</Text>
      </View>

      {/* Scoring labels */}
      {scoringRows.map((row, idx) => (
        <View key={row.field} style={[styles.labelRow, idx % 2 === 0 ? styles.gridRowEven : null]}>
          <Text style={styles.gridTraitLabel}>{row.label}</Text>
        </View>
      ))}

      {/* Trait labels */}
      {TRAITS.map((trait, idx) => (
        <View key={trait.posKey} style={[styles.labelRow, (idx + scoringRows.length) % 2 === 0 ? styles.gridRowEven : null]}>
          <Text style={styles.gridTraitLabel}>{trait.icon} {trait.label}</Text>
        </View>
      ))}

      {/* Notes label */}
      <View style={styles.labelRow}>
        <Text style={styles.gridTraitLabel}>📝 Notes</Text>
      </View>

      {/* Review label */}
      <View style={styles.labelRow}>
        <Text style={styles.gridTraitLabel}>⭐ Review</Text>
      </View>
    </>
  );

  // Build the right player-data columns content (scrolls horizontally)
  const renderRightColumns = () => (
    <>
      {/* Header row: player names */}
      <View style={styles.gridRow}>
        {players.map((sp) => {
          const qd = sp.quarterData.find((q) => q.quarter === activeQuarter);
          const qPos = qd?.position || sp.position || '';
          const posChanged = qd?.position && qd.position !== sp.position;
          return (
            <View key={sp.id} style={styles.gridHeaderCell}>
              <Text style={styles.gridPlayerName} numberOfLines={1}>
                {sp.player.fullName.split(' ').pop()}
              </Text>
              {sp.jumperNumber != null && (
                <Text style={styles.gridJumper}>#{sp.jumperNumber}</Text>
              )}
              <Text style={[styles.gridPlayerPos, posChanged ? { color: Colors.amber } : null]}>
                {qPos}{posChanged ? ' ↔' : ''}
              </Text>
              {sp.status === 'DNP' && (
                <View style={[styles.gridNewBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.gridNewText}>DNP</Text>
                </View>
              )}
              {sp.status === 'INJ' && (
                <View style={[styles.gridNewBadge, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.gridNewText}>INJ</Text>
                </View>
              )}
              {sp.isNewPlayer && !sp.status && (
                <View style={styles.gridNewBadge}>
                  <Text style={styles.gridNewText}>NEW</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Status row — DNP / INJ buttons per player */}
      <View style={[styles.gridRow, styles.statusRow]}>
        {players.map((sp) => {
          const isLocked = !!sp.status;
          return (
            <View key={sp.id} style={styles.gridStatusCell}>
              {!sp.status && (
                <View style={styles.gridStatusBtnRow}>
                  <TouchableOpacity
                    style={styles.gridDnpBtn}
                    onPress={() => handleSetDNP(sp.playerId, sp.player.fullName)}
                    disabled={statusUpdating}
                  >
                    <Ionicons name="close-circle-outline" size={12} color="#EF4444" />
                    <Text style={styles.gridDnpBtnText}>DNP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.gridInjBtn}
                    onPress={() => handleOpenInjuryModal(sp.playerId, sp.player.fullName)}
                    disabled={statusUpdating}
                  >
                    <Ionicons name="medkit-outline" size={12} color="#F59E0B" />
                    <Text style={styles.gridInjBtnText}>INJ</Text>
                  </TouchableOpacity>
                </View>
              )}
              {sp.status === 'DNP' && (
                <TouchableOpacity
                  style={styles.gridStatusActiveBadge}
                  onPress={() => handleClearStatus(sp.playerId, sp.player.fullName, 'DNP')}
                  disabled={statusUpdating}
                >
                  <View style={[styles.gridStatusBadge, { backgroundColor: '#EF4444' }]}>
                    <Ionicons name="close-circle" size={11} color="#fff" />
                    <Text style={styles.gridStatusBadgeText}>DNP</Text>
                  </View>
                  <Text style={styles.gridClearText}>Tap to clear</Text>
                </TouchableOpacity>
              )}
              {sp.status === 'INJ' && (
                <TouchableOpacity
                  style={styles.gridStatusActiveBadge}
                  onPress={() => handleClearStatus(sp.playerId, sp.player.fullName, 'INJ')}
                  disabled={statusUpdating}
                >
                  <View style={[styles.gridStatusBadge, { backgroundColor: '#F59E0B' }]}>
                    <Ionicons name="medkit" size={11} color="#fff" />
                    <Text style={styles.gridStatusBadgeText}>INJ Q{sp.injuryQuarter}</Text>
                  </View>
                  <Text style={styles.gridClearText}>Tap to clear</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Scoring rows (goals, behinds) — simple +/- counters */}
      {scoringRows.map((row, idx) => (
        <View key={row.field} style={[styles.gridRow, idx % 2 === 0 ? styles.gridRowEven : null]}>
          {players.map((sp) => {
            const val = getVal(sp, row.field);
            const isLocked = !!sp.status;
            return (
              <View key={sp.id} style={[styles.gridDataCell, isLocked && styles.gridCellLocked]}>
                <View style={styles.gridCellRow}>
                  <TouchableOpacity
                    style={[styles.gridMinus, isLocked && styles.gridBtnDisabled]}
                    onPress={() => handleStatUpdate(sp.playerId, row.field, -1)}
                    disabled={!!updating || isLocked}
                  >
                    <Text style={styles.gridMinusText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.gridCellValue}>{val}</Text>
                  <TouchableOpacity
                    style={[styles.gridPlus, isLocked && styles.gridBtnDisabled]}
                    onPress={() => handleStatUpdate(sp.playerId, row.field, 1)}
                    disabled={!!updating || isLocked}
                  >
                    <Text style={styles.gridPlusText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      {/* Trait rows — show +pos / -neg with rating */}
      {TRAITS.map((trait, idx) => (
        <View key={trait.posKey} style={[styles.gridRow, (idx + scoringRows.length) % 2 === 0 ? styles.gridRowEven : null]}>
          {players.map((sp) => {
            const pos = getVal(sp, trait.posKey);
            const neg = getVal(sp, trait.negKey);
            const rating = calcTraitRating(pos, neg);
            const isLocked = !!sp.status;
            return (
              <View key={sp.id} style={[styles.gridDataCell, isLocked && styles.gridCellLocked]}>
                <View style={styles.gridCellRow}>
                  <TouchableOpacity
                    style={[styles.gridPlus, isLocked && styles.gridBtnDisabled]}
                    onPress={() => handleStatUpdate(sp.playerId, trait.posKey, 1)}
                    disabled={!!updating || isLocked}
                  >
                    <Text style={styles.gridPlusText}>+</Text>
                  </TouchableOpacity>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.gridTraitScore}>
                      <Text style={{ color: '#10B981' }}>+{pos}</Text>
                      <Text style={{ color: Colors.textMuted }}>/</Text>
                      <Text style={{ color: '#EF4444' }}>-{neg}</Text>
                    </Text>
                    {rating != null && (
                      <Text style={[styles.gridRating, { color: rating >= 4 ? Colors.green : rating <= 2 ? Colors.error : Colors.amber }]}>
                        ★{rating.toFixed(1)}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.gridMinus, isLocked && styles.gridBtnDisabled]}
                    onPress={() => handleStatUpdate(sp.playerId, trait.negKey, 1)}
                    disabled={!!updating || isLocked}
                  >
                    <Text style={styles.gridMinusText}>−</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      {/* Notes row */}
      <View style={styles.gridRow}>
        {players.map((sp) => {
          const qd = sp.quarterData.find((q) => q.quarter === activeQuarter);
          const isLocked = !!sp.status;
          return (
            <TouchableOpacity
              key={sp.id}
              style={[styles.gridNotesCell, isLocked && styles.gridCellLocked]}
              onPress={() =>
                router.push(
                  `/live-scouting/notes?sessionId=${sessionId}&playerId=${sp.playerId}&quarter=${activeQuarter}` as any,
                )
              }
              disabled={isLocked}
            >
              <Text style={styles.gridNotesText} numberOfLines={2}>
                {isLocked ? (sp.status === 'DNP' ? '🚫 DNP' : '🏥 Injured') : (qd?.notes || 'Tap to add...')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Review row */}
      <View style={styles.gridRow}>
        {players.map((sp) => {
          const qd = sp.quarterData.find((q) => q.quarter === activeQuarter);
          const isLocked = !!sp.status;
          return (
            <TouchableOpacity
              key={sp.id}
              style={[styles.gridReviewCell, isLocked && styles.gridCellLocked]}
              onPress={() =>
                router.push(
                  `/live-scouting/quarter-review?sessionId=${sessionId}&playerId=${sp.playerId}&quarter=${activeQuarter}` as any,
                )
              }
              disabled={isLocked}
            >
              <Ionicons
                name={isLocked ? 'lock-closed' : qd?.reviewCompleted ? 'checkmark-circle' : 'star-outline'}
                size={18}
                color={isLocked ? Colors.textMuted : qd?.reviewCompleted ? Colors.green : Colors.amber}
              />
              <Text style={styles.gridReviewText}>
                {isLocked ? 'Locked' : qd?.reviewCompleted ? 'Done' : 'Review'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

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
          style={styles.addPlayerBtn}
          onPress={() => router.push(`/live-scouting/add-players?sessionId=${sessionId}&from=tracking` as any)}
        >
          <Ionicons name="person-add" size={16} color={Colors.green} />
          <Text style={styles.addPlayerBtnText}>Add Player</Text>
        </TouchableOpacity>
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

      {/* Injury modal */}
      <Modal
        visible={injuryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInjuryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mark as Injured</Text>
            <Text style={styles.modalSubtext}>
              {injuryTargetName ? `${injuryTargetName} — ` : ''}Select the quarter when the injury occurred:
            </Text>
            <View style={styles.modalQuarterRow}>
              {QUARTERS.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.modalQuarterBtn, injuryQuarterPick === q && styles.modalQuarterBtnActive]}
                  onPress={() => setInjuryQuarterPick(q)}
                >
                  <Text style={[styles.modalQuarterText, injuryQuarterPick === q && styles.modalQuarterTextActive]}>Q{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalLabel}>Injury Notes (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Hamstring, left knee..."
              placeholderTextColor={Colors.textMuted}
              value={injuryNotesText}
              onChangeText={setInjuryNotesText}
              multiline
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setInjuryModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleConfirmInjury}>
                <Text style={styles.modalConfirmText}>Confirm Injury</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Spreadsheet grid — fixed left labels + scrollable right player columns */}
      <View style={styles.gridWrapper}>
        {/* Fixed left label column */}
        <View style={styles.fixedLeftCol}>
          <ScrollView
            ref={leftScrollRef}
            onScroll={handleLeftScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContent}
            bounces={false}
          >
            {renderLeftColumn()}
          </ScrollView>
        </View>

        {/* Horizontally-scrollable player columns */}
        <ScrollView
          horizontal
          style={styles.gridScrollH}
          showsHorizontalScrollIndicator={true}
          bounces={false}
        >
          <ScrollView
            ref={rightScrollRef}
            onScroll={handleRightScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.gridContent}
            bounces={false}
          >
            {renderRightColumns()}
          </ScrollView>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { color: Colors.textSecondary, marginTop: 12 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.elevated, justifyContent: 'center', alignItems: 'center',
  },
  gameTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  gameMeta: { color: Colors.textSecondary, fontSize: 12 },
  addPlayerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.green, backgroundColor: 'rgba(16,185,129,0.08)',
  },
  addPlayerBtnText: { color: Colors.green, fontSize: 12, fontWeight: '700' },
  switchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.accent, backgroundColor: 'rgba(6,182,212,0.08)',
  },
  switchText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },

  quarterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
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

  // Grid wrapper: side-by-side fixed left col + scrollable right area
  gridWrapper: { flex: 1, flexDirection: 'row' },
  fixedLeftCol: {
    width: LABEL_COL_WIDTH,
    borderRightWidth: 2,
    borderRightColor: Colors.border,
    backgroundColor: Colors.card,
    // Subtle shadow to visually separate the fixed column
    ...(Platform.OS === 'web'
      ? { boxShadow: '3px 0 8px rgba(0,0,0,0.25)' } as any
      : {
          shadowColor: '#000', shadowOffset: { width: 3, height: 0 },
          shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
        }),
    zIndex: 2,
  },

  gridScrollH: { flex: 1 },
  gridContent: { paddingBottom: 40 },

  // Label row for the fixed left column — must match height of data rows
  labelRow: {
    width: LABEL_COL_WIDTH,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  headerLabelRow: {
    backgroundColor: Colors.elevated,
  },

  gridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  gridRowEven: { backgroundColor: 'rgba(255,255,255,0.02)' },

  gridLabelText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  gridTraitLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },

  gridHeaderCell: {
    width: PLAYER_COL_WIDTH, paddingHorizontal: 8, paddingVertical: 10,
    alignItems: 'center', borderRightWidth: 1, borderRightColor: Colors.border,
    backgroundColor: Colors.elevated, minHeight: 52,
  },
  gridPlayerName: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  gridJumper: { color: Colors.accent, fontSize: 13, fontWeight: '900', marginTop: 1 },
  gridPlayerPos: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  gridNewBadge: { backgroundColor: Colors.green, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, marginTop: 2 },
  gridNewText: { color: '#fff', fontSize: 7, fontWeight: '800' },

  gridDataCell: {
    width: PLAYER_COL_WIDTH, paddingVertical: 6, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: Colors.border,
    minHeight: 52,
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
  gridTraitScore: { fontSize: 12, fontWeight: '700' },
  gridRating: { fontSize: 10, fontWeight: '700', marginTop: 2 },

  gridNotesCell: {
    width: PLAYER_COL_WIDTH, paddingHorizontal: 8, paddingVertical: 10,
    justifyContent: 'center', borderRightWidth: 1, borderRightColor: Colors.border,
    minHeight: 52,
  },
  gridNotesText: { color: Colors.textMuted, fontSize: 11, fontStyle: 'italic' },

  gridReviewCell: {
    width: PLAYER_COL_WIDTH, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: Colors.border,
    minHeight: 52,
  },
  gridReviewText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Status row
  statusLabelRow: { backgroundColor: 'rgba(245,158,11,0.04)' },
  statusRow: { backgroundColor: 'rgba(245,158,11,0.04)' },
  gridStatusCell: {
    width: PLAYER_COL_WIDTH, paddingVertical: 6, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: Colors.border,
    minHeight: 52,
  },
  gridStatusBtnRow: { flexDirection: 'row', gap: 4 },
  gridDnpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)',
  },
  gridDnpBtnText: { color: '#EF4444', fontSize: 10, fontWeight: '800' },
  gridInjBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', backgroundColor: 'rgba(245,158,11,0.08)',
  },
  gridInjBtnText: { color: '#F59E0B', fontSize: 10, fontWeight: '800' },
  gridStatusActiveBadge: { alignItems: 'center', gap: 2 },
  gridStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5,
  },
  gridStatusBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  gridClearText: { color: Colors.textMuted, fontSize: 8, fontStyle: 'italic' },

  // Locked cell styling
  gridCellLocked: { opacity: 0.35 },
  gridBtnDisabled: { opacity: 0.3 },

  // Injury modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 380, borderWidth: 1, borderColor: Colors.border,
  },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSubtext: { color: Colors.textSecondary, fontSize: 13, marginBottom: 16 },
  modalQuarterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modalQuarterBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border,
  },
  modalQuarterBtnActive: { backgroundColor: 'rgba(245,158,11,0.2)', borderColor: '#F59E0B' },
  modalQuarterText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  modalQuarterTextActive: { color: '#F59E0B' },
  modalLabel: { color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  modalInput: {
    backgroundColor: Colors.elevated, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    padding: 12, color: Colors.text, fontSize: 14, minHeight: 60, textAlignVertical: 'top', marginBottom: 16,
  },
  modalBtnRow: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.elevated,
  },
  modalCancelText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  modalConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#F59E0B',
  },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
