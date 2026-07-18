import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  Platform,
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
  PlayerStatus,
} from '../../src/api/liveScouting';
import { isSessionExpiredError } from '../../src/api/client';
import { useLiveGame } from '../../src/context/LiveGameContext';

const QUARTERS = [1, 2, 3, 4];

type LoadErrorKind = 'session_expired' | 'generic' | null;

export default function TrackingScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<LiveScoutingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorKind>(null);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string>('');
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [activeQuarter, setActiveQuarter] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [injuryModalVisible, setInjuryModalVisible] = useState(false);
  const [injuryQuarterPick, setInjuryQuarterPick] = useState<number>(1);
  const [injuryNotesText, setInjuryNotesText] = useState('');
  const [jumperModalVisible, setJumperModalVisible] = useState(false);
  const [jumperInputText, setJumperInputText] = useState('');
  const [jumperUpdating, setJumperUpdating] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      setLoadError('generic');
      setLoadErrorMessage('No session id provided.');
      return;
    }
    setLoading(true);
    setLoadError(null);
    setLoadErrorMessage('');
    try {
      const s = await liveScoutingApi.getSession(sessionId);
      setSession(s);
    } catch (err: any) {
      if (isSessionExpiredError(err)) {
        setLoadError('session_expired');
        setLoadErrorMessage('Your session has expired. Please log in again.');
      } else {
        const msg = err?.message || 'Failed to load session.';
        setLoadError('generic');
        setLoadErrorMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Reload session on mount and when returning from add-players screen
  useFocusEffect(
    useCallback(() => {
      loadSession();
    }, [loadSession])
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

  // All hooks must be called unconditionally
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 768;
  useEffect(() => {
    if (isWide && session && session.sessionPlayers.length > 1) {
      // On tablets/desktop, suggest grid view
    }
  }, [isWide, session]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading session...</Text>
      </View>
    );
  }

  if (loadError === 'session_expired') {
    return (
      <View style={styles.center}>
        <View style={styles.errorCard}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="time-outline" size={36} color={Colors.amber} />
          </View>
          <Text style={styles.errorTitle}>Session expired</Text>
          <Text style={styles.errorMessage}>{loadErrorMessage}</Text>
          <TouchableOpacity
            style={styles.errorPrimaryBtn}
            onPress={() => router.replace('/auth/login')}
          >
            <Ionicons name="log-in-outline" size={18} color="#fff" />
            <Text style={styles.errorPrimaryBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loadError === 'generic' || !session) {
    return (
      <View style={styles.center}>
        <View style={styles.errorCard}>
          <View style={[styles.errorIconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
          </View>
          <Text style={styles.errorTitle}>Couldn't load session</Text>
          <Text style={styles.errorMessage}>
            {loadErrorMessage || 'Something went wrong while loading this scouting session.'}
          </Text>
          <View style={styles.errorBtnRow}>
            <TouchableOpacity style={styles.errorSecondaryBtn} onPress={() => router.replace('/dashboard' as any)}>
              <Ionicons name="home-outline" size={18} color={Colors.accent} />
              <Text style={styles.errorSecondaryBtnText}>Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.errorPrimaryBtn} onPress={loadSession}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.errorPrimaryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
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
      setSession((prev) => {
        if (!prev) return prev;
        const newPlayers = prev.sessionPlayers.map((sp) => {
          if (sp.playerId !== currentPlayer.playerId) return sp;
          const newQD = sp.quarterData.map((q) =>
            q.quarter === activeQuarter ? { ...q, ...updatedQD } : q,
          );
          if (!sp.quarterData.find((q) => q.quarter === activeQuarter)) {
            newQD.push(updatedQD);
          }
          return { ...sp, quarterData: newQD };
        });
        return { ...prev, sessionPlayers: newPlayers };
      });
    } catch (err: any) {
      if (isSessionExpiredError(err)) {
        setLoadError('session_expired');
        setLoadErrorMessage('Your session has expired. Please log in again.');
      } else {
        console.error('Stat update failed:', err);
      }
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

  const handleSetDNP = () => {
    const doIt = async () => {
      setStatusUpdating(true);
      try {
        await liveScoutingApi.updatePlayerStatus(sessionId!, currentPlayer.playerId, {
          status: 'DNP',
        });
        await loadSession();
      } catch (err: any) {
        if (isSessionExpiredError(err)) {
          setLoadError('session_expired');
          setLoadErrorMessage('Your session has expired. Please log in again.');
        } else {
          Alert.alert('Error', err?.message || 'Failed to update status');
        }
      } finally {
        setStatusUpdating(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Mark ${currentPlayer.player.fullName} as DNP (Did Not Play)? This will lock all inputs for this player.`)) {
        doIt();
      }
    } else {
      Alert.alert(
        'Confirm DNP',
        `Mark ${currentPlayer.player.fullName} as DNP (Did Not Play)? This will lock all inputs for this player.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', style: 'destructive', onPress: doIt },
        ],
      );
    }
  };

  const handleOpenInjuryModal = () => {
    setInjuryQuarterPick(activeQuarter);
    setInjuryNotesText('');
    setInjuryModalVisible(true);
  };

  const handleConfirmInjury = async () => {
    setInjuryModalVisible(false);
    setStatusUpdating(true);
    try {
      await liveScoutingApi.updatePlayerStatus(sessionId!, currentPlayer.playerId, {
        status: 'INJ',
        injuryQuarter: injuryQuarterPick,
        injuryNotes: injuryNotesText.trim() || undefined,
      });
      await loadSession();
    } catch (err: any) {
      if (isSessionExpiredError(err)) {
        setLoadError('session_expired');
        setLoadErrorMessage('Your session has expired. Please log in again.');
      } else {
        Alert.alert('Error', err?.message || 'Failed to update status');
      }
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleClearStatus = () => {
    const doIt = async () => {
      setStatusUpdating(true);
      try {
        await liveScoutingApi.updatePlayerStatus(sessionId!, currentPlayer.playerId, {
          status: null as any,
        });
        await loadSession();
      } catch (err: any) {
        if (isSessionExpiredError(err)) {
          setLoadError('session_expired');
          setLoadErrorMessage('Your session has expired. Please log in again.');
        } else {
          Alert.alert('Error', err?.message || 'Failed to clear status');
        }
      } finally {
        setStatusUpdating(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Clear ${currentPlayer.status} status for ${currentPlayer.player.fullName}?`)) {
        doIt();
      }
    } else {
      Alert.alert(
        'Clear Status',
        `Clear ${currentPlayer.status} status for ${currentPlayer.player.fullName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear', onPress: doIt },
        ],
      );
    }
  };

  const handleOpenJumperModal = () => {
    setJumperInputText(currentPlayer.jumperNumber != null ? String(currentPlayer.jumperNumber) : '');
    setJumperModalVisible(true);
  };

  const handleConfirmJumper = async () => {
    const trimmed = jumperInputText.trim();
    const value = trimmed === '' ? null : parseInt(trimmed, 10);
    setJumperModalVisible(false);
    setJumperUpdating(true);
    try {
      await liveScoutingApi.updatePlayerDetails(sessionId!, currentPlayer.playerId, {
        jumperNumber: value,
      });
      await loadSession();
    } catch (err: any) {
      if (isSessionExpiredError(err)) {
        setLoadError('session_expired');
        setLoadErrorMessage('Your session has expired. Please log in again.');
      } else {
        Alert.alert('Error', err?.message || 'Failed to update jumper number');
      }
    } finally {
      setJumperUpdating(false);
    }
  };

  const isPlayerLocked = !!(currentPlayer.status);

  const getVal = (field: string): number => {
    if (!currentQD) return 0;
    return (currentQD as any)[field] || 0;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Game header */}
      <View style={styles.gameHeader}>
        <Text style={styles.gameTitle}>{session.gameTitle}</Text>
        <Text style={styles.gameMeta}>
          {session.competition ? `${session.competition} · ` : ''}
          {session.venue || 'No venue'}
        </Text>
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
            {sp.jumperNumber != null && (
              <Text style={[styles.playerTabJumper, activePlayerIdx === idx && styles.playerTabJumperActive]}>
                #{sp.jumperNumber}
              </Text>
            )}
            {sp.status === 'DNP' && (
              <View style={styles.dnpBadge}>
                <Text style={styles.statusBadgeText}>DNP</Text>
              </View>
            )}
            {sp.status === 'INJ' && (
              <View style={styles.injBadge}>
                <Text style={styles.statusBadgeText}>INJ</Text>
              </View>
            )}
            {sp.isNewPlayer && !sp.status && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.addPlayerTab}
          onPress={() => router.push(`/live-scouting/add-players?sessionId=${sessionId}&from=tracking` as any)}
        >
          <Ionicons name="add" size={18} color={Colors.accent} />
          <Text style={styles.addPlayerTabText}>Add</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Player info */}
      <View style={styles.playerHeader}>
        <View style={styles.playerNameRow}>
          <TouchableOpacity
            style={[styles.jumperPill, currentPlayer.jumperNumber == null && styles.jumperPillEmpty]}
            onPress={handleOpenJumperModal}
            disabled={jumperUpdating}
          >
            {jumperUpdating ? (
              <ActivityIndicator color={Colors.accent} size="small" />
            ) : currentPlayer.jumperNumber != null ? (
              <Text style={styles.jumperPillNumber}>#{currentPlayer.jumperNumber}</Text>
            ) : (
              <>
                <Ionicons name="shirt-outline" size={16} color={Colors.accent} />
                <Text style={styles.jumperPillAddText}>Set #</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={[styles.playerName, { flex: 1 }]}>{currentPlayer.player.fullName}</Text>
          {currentPlayer.jumperNumber != null && (
            <TouchableOpacity onPress={handleOpenJumperModal} disabled={jumperUpdating} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="pencil" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.playerInfo}>
          {[currentQD?.position || currentPlayer.position, currentPlayer.representingTeam || currentPlayer.player.team, currentPlayer.player.draftYear ? `Draft ${currentPlayer.player.draftYear}` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {currentPlayer.representingTeam && currentPlayer.representingTeam !== currentPlayer.player.team && (
          <Text style={styles.repTeamLabel}>🏟️ Representing: {currentPlayer.representingTeam}</Text>
        )}
        {currentQD?.position && currentQD.position !== currentPlayer.position && (
          <View style={styles.positionChangeBadge}>
            <Ionicons name="swap-horizontal" size={12} color={Colors.amber} />
            <Text style={styles.positionChangeText}>
              Moved from {currentPlayer.position || 'N/A'}
            </Text>
          </View>
        )}

        {/* Status action buttons */}
        {!currentPlayer.status && (
          <View style={styles.statusBtnRow}>
            <TouchableOpacity
              style={styles.dnpBtn}
              onPress={handleSetDNP}
              disabled={statusUpdating}
            >
              <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
              <Text style={styles.dnpBtnText}>DNP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.injBtn}
              onPress={handleOpenInjuryModal}
              disabled={statusUpdating}
            >
              <Ionicons name="medkit-outline" size={14} color="#F59E0B" />
              <Text style={styles.injBtnText}>INJ</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status clear button */}
        {currentPlayer.status && (
          <TouchableOpacity style={styles.clearStatusBtn} onPress={handleClearStatus} disabled={statusUpdating}>
            <Ionicons name="refresh-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.clearStatusBtnText}>Clear {currentPlayer.status} Status</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status locked banner */}
      {currentPlayer.status === 'DNP' && (
        <View style={styles.dnpBanner}>
          <Ionicons name="close-circle" size={20} color="#EF4444" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Did Not Play</Text>
            <Text style={styles.bannerSubtext}>All inputs are locked. This player will be excluded from analysis.</Text>
          </View>
        </View>
      )}
      {currentPlayer.status === 'INJ' && (
        <View style={styles.injBanner}>
          <Ionicons name="medkit" size={20} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Injured — Q{currentPlayer.injuryQuarter}</Text>
            <Text style={styles.bannerSubtext}>
              Inputs are locked. Only pre-injury data (Q1{currentPlayer.injuryQuarter && currentPlayer.injuryQuarter > 1 ? `–Q${currentPlayer.injuryQuarter - 1}` : ''}) will be used in analysis.
              {currentPlayer.injuryNotes ? `\nNotes: ${currentPlayer.injuryNotes}` : ''}
            </Text>
          </View>
        </View>
      )}

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
            <Text style={styles.modalSubtext}>Select the quarter when the injury occurred:</Text>
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

      {/* Jumper number modal */}
      <Modal
        visible={jumperModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJumperModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Jumper Number</Text>
            <Text style={styles.modalSubtext}>
              Playing number for {currentPlayer.player.fullName} this game:
            </Text>
            <TextInput
              style={styles.jumperModalInput}
              placeholder="#"
              placeholderTextColor={Colors.textMuted}
              value={jumperInputText}
              onChangeText={(t) => setJumperInputText(t.replace(/[^0-9]/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              autoFocus
            />
            <Text style={styles.modalSubtext}>Leave blank to clear.</Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setJumperModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleConfirmJumper}>
                <Text style={styles.modalConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Quarter tabs */}
      <View style={styles.quarterRow}>
        {QUARTERS.map((q) => {
          const qd = currentPlayer.quarterData.find((qd) => qd.quarter === q);
          const hasData = qd && (
            qd.goals > 0 || qd.behinds > 0 ||
            TRAITS.some((t) => ((qd as any)[t.posKey] || 0) + ((qd as any)[t.negKey] || 0) > 0)
          );
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

      {/* Goals & Behinds row */}
      <View style={[styles.scoringRow, isPlayerLocked && styles.lockedSection]}>
        <View style={styles.scoringCard}>
          <Text style={styles.scoringLabel}>⚽ Goals</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={[styles.counterBtnMinus, isPlayerLocked && styles.disabledBtn]}
              onPress={() => handleStatUpdate('goals', -1)}
              disabled={!!updating || isPlayerLocked}
            >
              <Text style={styles.counterBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.scoringValue}>{getVal('goals')}</Text>
            <TouchableOpacity
              style={[styles.counterBtnPlus, isPlayerLocked && styles.disabledBtn]}
              onPress={() => handleStatUpdate('goals', 1)}
              disabled={!!updating || isPlayerLocked}
            >
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.scoringCard}>
          <Text style={styles.scoringLabel}>🥅 Behinds</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={[styles.counterBtnMinus, isPlayerLocked && styles.disabledBtn]}
              onPress={() => handleStatUpdate('behinds', -1)}
              disabled={!!updating || isPlayerLocked}
            >
              <Text style={styles.counterBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.scoringValue}>{getVal('behinds')}</Text>
            <TouchableOpacity
              style={[styles.counterBtnPlus, isPlayerLocked && styles.disabledBtn]}
              onPress={() => handleStatUpdate('behinds', 1)}
              disabled={!!updating || isPlayerLocked}
            >
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Trait observation section */}
      <Text style={styles.sectionTitle}>Trait Observations</Text>
      <Text style={styles.sectionHint}>{isPlayerLocked ? 'Inputs locked — player marked as ' + currentPlayer.status : 'Tap + for good observations, − for poor'}</Text>

      <View style={isPlayerLocked ? styles.lockedSection : undefined}>
        {TRAITS.map((trait) => {
          const pos = getVal(trait.posKey);
          const neg = getVal(trait.negKey);
          return (
            <View key={trait.posKey} style={styles.traitRow}>
              <View style={styles.traitLabelWrap}>
                <Text style={styles.traitIcon}>{trait.icon}</Text>
                <Text style={styles.traitLabel}>{trait.label}</Text>
              </View>
              <View style={styles.traitControls}>
                <TouchableOpacity
                  style={[styles.traitBtnPlus, isPlayerLocked && styles.disabledBtn]}
                  onPress={() => handleStatUpdate(trait.posKey, 1)}
                  disabled={!!updating || isPlayerLocked}
                >
                  <Text style={styles.plusText}>+</Text>
                </TouchableOpacity>
                <View style={styles.traitScoreWrap}>
                  <Text style={styles.traitScorePos}>+{pos}</Text>
                  <Text style={styles.traitScoreSep}>/</Text>
                  <Text style={styles.traitScoreNeg}>-{neg}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.traitBtnMinus, isPlayerLocked && styles.disabledBtn]}
                  onPress={() => handleStatUpdate(trait.negKey, 1)}
                  disabled={!!updating || isPlayerLocked}
                >
                  <Text style={styles.minusText}>−</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.notesBtn, isPlayerLocked && styles.disabledBtn]} onPress={goToNotes} disabled={isPlayerLocked}>
          <Ionicons name="create-outline" size={18} color={isPlayerLocked ? Colors.textMuted : Colors.accent} />
          <Text style={[styles.notesBtnText, isPlayerLocked && { color: Colors.textMuted }]}>Notes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.reviewBtn, isPlayerLocked && styles.disabledBtn]} onPress={goToReview} disabled={isPlayerLocked}>
          <Ionicons name="star-outline" size={18} color={isPlayerLocked ? Colors.textMuted : Colors.amber} />
          <Text style={[styles.reviewBtnText, isPlayerLocked && { color: Colors.textMuted }]}>Quarter Review</Text>
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

  /* Error / session-expired card */
  errorCard: {
    backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, padding: 24, width: '100%', maxWidth: 380, alignItems: 'center',
  },
  errorIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(245,158,11,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  errorTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  errorMessage: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  errorBtnRow: { flexDirection: 'row', gap: 10, width: '100%', justifyContent: 'center' },
  errorPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10,
  },
  errorPrimaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  errorSecondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.accent, backgroundColor: 'rgba(6,182,212,0.08)',
  },
  errorSecondaryBtnText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },

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
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.elevated, marginRight: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  playerTabActive: { backgroundColor: 'rgba(6,182,212,0.2)', borderWidth: 1, borderColor: Colors.accent },
  playerTabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  playerTabTextActive: { color: Colors.accent },
  playerTabJumper: { color: Colors.textMuted, fontSize: 12, fontWeight: '800', marginTop: 1 },
  playerTabJumperActive: { color: Colors.accent },
  newBadge: { backgroundColor: Colors.green, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  newBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },
  addPlayerTab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.accent, borderStyle: 'dashed',
    backgroundColor: 'rgba(6,182,212,0.08)', marginRight: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  addPlayerTabText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },

  playerHeader: { alignItems: 'center', marginBottom: 16 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  jumperPill: {
    minWidth: 48, height: 40, borderRadius: 10, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3, paddingHorizontal: 8,
  },
  jumperPillEmpty: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.accent, borderStyle: 'dashed',
  },
  jumperPillNumber: { color: '#fff', fontSize: 22, fontWeight: '900' },
  jumperPillAddText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  playerName: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  playerInfo: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  repTeamLabel: { color: '#10B981', fontSize: 11, fontWeight: '600', marginTop: 3 },
  positionChangeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, marginTop: 4,
  },
  positionChangeText: { color: Colors.amber, fontSize: 11, fontWeight: '600' },

  quarterRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  quarterTab: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  quarterTabActive: { backgroundColor: 'rgba(79,70,229,0.2)', borderColor: Colors.primary },
  quarterTabText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  quarterTabTextActive: { color: Colors.primary },
  quarterDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green, marginTop: 4 },

  // Scoring
  scoringRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  scoringCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  scoringLabel: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counterBtnMinus: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  counterBtnPlus: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  counterBtnText: { fontSize: 26, fontWeight: '700', color: Colors.text },
  scoringValue: { fontSize: 30, fontWeight: '800', color: Colors.text, minWidth: 40, textAlign: 'center' },

  // Section
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sectionHint: { color: Colors.textMuted, fontSize: 12, marginBottom: 12 },

  // Trait rows
  traitRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
  },
  traitLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  traitIcon: { fontSize: 20 },
  traitLabel: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  traitControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  traitBtnPlus: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  traitBtnMinus: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  plusText: { fontSize: 24, fontWeight: '800', color: '#10B981' },
  minusText: { fontSize: 24, fontWeight: '800', color: '#EF4444' },
  traitScoreWrap: { flexDirection: 'row', alignItems: 'center', minWidth: 70, justifyContent: 'center' },
  traitScorePos: { color: '#10B981', fontSize: 15, fontWeight: '800' },
  traitScoreSep: { color: Colors.textMuted, fontSize: 13, marginHorizontal: 2 },
  traitScoreNeg: { color: '#EF4444', fontSize: 15, fontWeight: '800' },

  // Actions
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 16 },
  notesBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.accent,
    backgroundColor: 'rgba(6,182,212,0.08)',
  },
  notesBtnText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  reviewBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.amber,
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  reviewBtnText: { color: Colors.amber, fontSize: 14, fontWeight: '700' },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, marginBottom: 40,
  },
  completeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Status badges on player tabs
  dnpBadge: { backgroundColor: '#EF4444', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  injBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  statusBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },

  // Status action buttons
  statusBtnRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dnpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)',
  },
  dnpBtnText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  injBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', backgroundColor: 'rgba(245,158,11,0.08)',
  },
  injBtnText: { color: '#F59E0B', fontSize: 12, fontWeight: '700' },
  clearStatusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.elevated,
  },
  clearStatusBtnText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },

  // Status banners
  dnpBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  injBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  bannerTitle: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  bannerSubtext: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },

  // Locked section overlay
  lockedSection: { opacity: 0.45 },
  disabledBtn: { opacity: 0.4 },

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
  jumperModalInput: {
    backgroundColor: Colors.elevated, borderRadius: 10, borderWidth: 1, borderColor: Colors.accent,
    paddingVertical: 14, color: Colors.text, fontSize: 32, fontWeight: '900', textAlign: 'center',
    letterSpacing: 2, marginTop: 8, marginBottom: 8,
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
