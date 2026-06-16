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
  Linking,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import {
  liveScoutingApi,
  LiveScoutingSession,
  TRAITS,
  SLIDER_TRAITS,
  calcTraitRating,
} from '../../src/api/liveScouting';
import { getToken } from '../../src/api/client';
import SyncStatusBadge from '../../src/components/SyncStatusBadge';

function ratingColor(v: number) {
  return v >= 4 ? '#10B981' : v >= 3 ? '#F59E0B' : '#EF4444';
}

function ratingBg(v: number) {
  return v >= 4 ? 'rgba(16,185,129,0.12)' : v >= 3 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
}

export default function SessionSummaryScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<LiveScoutingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [editFields, setEditFields] = useState({
    gameTitle: '',
    homeTeam: '',
    awayTeam: '',
    venue: '',
    competition: '',
  });
  const [savingInfo, setSavingInfo] = useState(false);
  const [dataEdited, setDataEdited] = useState(false);

  // End-of-game athletic trait ratings (game-level), keyed by playerId.
  // Synced from the loaded session and persisted via the player-details endpoint.
  const [athleticRatings, setAthleticRatings] = useState<
    Record<string, { speedRating: number | null; flexibilityRating: number | null; gameAwarenessRating: number | null }>
  >({});
  const [savingRating, setSavingRating] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const s = await liveScoutingApi.getSession(sessionId);
      setSession(s);
    } catch {} finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Reload session when screen gains focus (e.g. returning from quarter edit)
  useFocusEffect(
    useCallback(() => {
      loadSession();
    }, [loadSession]),
  );

  // Keep local athletic ratings in sync with the loaded session
  useEffect(() => {
    if (!session) return;
    const map: Record<string, { speedRating: number | null; flexibilityRating: number | null; gameAwarenessRating: number | null }> = {};
    session.sessionPlayers.forEach((sp) => {
      map[sp.playerId] = {
        speedRating: sp.speedRating ?? null,
        flexibilityRating: sp.flexibilityRating ?? null,
        gameAwarenessRating: sp.gameAwarenessRating ?? null,
      };
    });
    setAthleticRatings(map);
  }, [session]);

  // Persist an athletic trait rating for a player. Tapping the active value clears it.
  const setAthleticRating = async (
    playerId: string,
    key: 'speedRating' | 'flexibilityRating' | 'gameAwarenessRating',
    value: number,
  ) => {
    if (!sessionId) return;
    const current = athleticRatings[playerId]?.[key] ?? null;
    const newVal = current === value ? null : value;
    // optimistic update
    setAthleticRatings((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [key]: newVal },
    }));
    setSavingRating(`${playerId}:${key}`);
    try {
      await liveScoutingApi.updatePlayerDetails(sessionId, playerId, { [key]: newVal });
      setDataEdited(true);
    } catch (err: any) {
      // revert on failure
      setAthleticRatings((prev) => ({
        ...prev,
        [playerId]: { ...prev[playerId], [key]: current },
      }));
      const msg = err?.message || 'Failed to save rating';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setSavingRating(null);
    }
  };

  // Players that must have athletic ratings before the game can be finalised.
  // DNP (Did Not Play) players are excluded — they were never observed.
  const playersMissingAthletic = (): string[] => {
    if (!session) return [];
    return session.sessionPlayers
      .filter((sp) => sp.status !== 'DNP')
      .filter((sp) => {
        const r = athleticRatings[sp.playerId];
        return !r || r.speedRating == null || r.flexibilityRating == null || r.gameAwarenessRating == null;
      })
      .map((sp) => sp.player.fullName);
  };

  const openEditInfoModal = () => {
    if (!session) return;
    setEditFields({
      gameTitle: session.gameTitle || '',
      homeTeam: session.homeTeam || '',
      awayTeam: session.awayTeam || '',
      venue: session.venue || '',
      competition: session.competition || '',
    });
    setShowEditInfo(true);
  };

  const handleSaveInfo = async () => {
    if (!sessionId) return;
    setSavingInfo(true);
    try {
      await liveScoutingApi.updateSession(sessionId, editFields);
      setDataEdited(true);
      setShowEditInfo(false);
      await loadSession();
      const msg = 'Session info updated!';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err?.message || 'Failed to update session info';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setSavingInfo(false);
    }
  };

  const navigateToQuarterEdit = (playerId: string, quarter: number) => {
    setDataEdited(true);
    router.push(
      `/live-scouting/quarter-review?sessionId=${sessionId}&playerId=${playerId}&quarter=${quarter}` as any,
    );
  };

  const handleComplete = async () => {
    if (!sessionId) return;

    // Athletic traits (Speed, Flexibility, Game Awareness) are MANDATORY before
    // the game can be finalised. Block and prompt if any are missing.
    const missing = playersMissingAthletic();
    if (missing.length > 0) {
      const msg =
        `Please complete the Athletic Traits ratings (Speed, Flexibility, Game Awareness) for every player before finalising the game.\n\nMissing for: ${missing.join(', ')}.`;
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Athletic Traits Required', msg);
      return;
    }

    const doComplete = async () => {
      setCompleting(true);
      try {
        await liveScoutingApi.completeSession(sessionId);
        if (Platform.OS === 'web') {
          window.alert('Session completed successfully!');
        } else {
          Alert.alert('Success', 'Session completed successfully!');
        }
        router.replace('/live-scouting/sessions' as any);
      } catch (err: any) {
        const msg = err?.message || 'Failed to complete session';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
      } finally {
        setCompleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Complete this scouting session? This cannot be undone.')) {
        doComplete();
      }
    } else {
      Alert.alert('Complete Session', 'Complete this scouting session? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete', style: 'default', onPress: doComplete },
      ]);
    }
  };

  if (loading || !session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>
            {session.status === 'COMPLETED' ? '🏆 Session Complete' : 'Session Summary'}
          </Text>
          <Text style={styles.subtitle}>{session.gameTitle}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* ─── Completion Hero Banner ─── */}
      {session.status === 'COMPLETED' && (
        <View style={styles.heroBanner}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="trophy" size={24} color={Colors.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Session Complete</Text>
              <Text style={styles.heroDesc}>
                All quarters recorded — review below before generating reports
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{session.sessionPlayers.length}</Text>
              <Text style={styles.heroStatLabel}>PLAYERS</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>4</Text>
              <Text style={styles.heroStatLabel}>QUARTERS</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: Colors.green }]}>
                {session.status}
              </Text>
              <Text style={styles.heroStatLabel}>STATUS</Text>
            </View>
          </View>
        </View>
      )}

      {/* ─── Edit Mode Toggle (COMPLETED sessions only) ─── */}
      {session.status === 'COMPLETED' && (
        <TouchableOpacity
          style={[styles.editModeBtn, editMode && styles.editModeBtnActive]}
          onPress={() => setEditMode(!editMode)}
        >
          <Ionicons
            name={editMode ? 'checkmark-done' : 'create-outline'}
            size={18}
            color={editMode ? '#fff' : Colors.accent}
          />
          <Text style={[styles.editModeBtnText, editMode && styles.editModeBtnTextActive]}>
            {editMode ? 'Done Editing' : 'Edit Session'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ─── Stale AI Warning ─── */}
      {editMode && session.aiSummary && (
        <View style={styles.staleAiBanner}>
          <Ionicons name="warning" size={18} color="#F59E0B" />
          <Text style={styles.staleAiText}>
            Editing session data may make AI analysis stale. Regenerate AI analysis after editing to
            reflect changes.
          </Text>
        </View>
      )}

      {/* ─── Game Info Card ─── */}
      <View style={styles.gameInfoCard}>
        <View style={styles.gameInfoRow}>
          <View style={styles.gameInfoItem}>
            <Text style={styles.gameInfoLabel}>MATCH</Text>
            <Text style={styles.gameInfoValue}>{session.homeTeam} vs {session.awayTeam}</Text>
          </View>
          {session.competition && (
            <View style={styles.gameInfoItem}>
              <Text style={styles.gameInfoLabel}>COMPETITION</Text>
              <View style={styles.compBadge}>
                <Text style={styles.compBadgeText}>{session.competition}</Text>
              </View>
            </View>
          )}
        </View>
        <View style={styles.gameInfoRow}>
          {session.venue && (
            <View style={styles.gameInfoItem}>
              <Text style={styles.gameInfoLabel}>VENUE</Text>
              <Text style={styles.gameInfoValue}>{session.venue}</Text>
            </View>
          )}
          <View style={styles.gameInfoItem}>
            <Text style={styles.gameInfoLabel}>DATE</Text>
            <Text style={styles.gameInfoValue}>
              {new Date(session.gameDate).toLocaleDateString()}
            </Text>
          </View>
        </View>
        {editMode && (
          <TouchableOpacity style={styles.editInfoBtn} onPress={openEditInfoModal}>
            <Ionicons name="create-outline" size={16} color={Colors.accent} />
            <Text style={styles.editInfoBtnText}>Edit Game Info</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Player Summary Cards ─── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>Player Summary Cards</Text>
        <Text style={styles.sectionHeaderBadge}>
          {session.sessionPlayers.length} player{session.sessionPlayers.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {session.sessionPlayers.map((sp) => {
        const totalGoals = sp.quarterData.reduce((sum, q) => sum + q.goals, 0);
        const totalBehinds = sp.quarterData.reduce((sum, q) => sum + q.behinds, 0);
        const isExpanded = notesExpanded[sp.id] !== false; // default expanded

        // Calculate overall rating across all traits (9 observation + 3 slider)
        let overallSum = 0;
        let overallCount = 0;
        TRAITS.forEach((trait) => {
          const totalPos = sp.quarterData.reduce((s, q) => s + ((q as any)[trait.posKey] || 0), 0);
          const totalNeg = sp.quarterData.reduce((s, q) => s + ((q as any)[trait.negKey] || 0), 0);
          const r = calcTraitRating(totalPos, totalNeg);
          if (r !== null) {
            overallSum += r;
            overallCount++;
          }
        });
        // Include end-of-game athletic trait ratings (game-level) in overall average
        SLIDER_TRAITS.forEach((st) => {
          const val = (sp as any)[st.key] as number | null;
          if (val != null) {
            overallSum += val;
            overallCount++;
          }
        });
        const overallRating = overallCount > 0
          ? Math.round((overallSum / overallCount) * 10) / 10
          : null;

        // Collect all notes
        const allNotes = sp.quarterData
          .filter((q) => q.notes)
          .map((q) => ({ quarter: q.quarter, notes: q.notes! }));

        return (
          <View key={sp.id} style={styles.playerCard}>
            {/* Player Header */}
            <View style={styles.playerHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={styles.playerName}>{sp.player.fullName}</Text>
                  {sp.status === 'DNP' && (
                    <View style={{ backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>DNP</Text>
                    </View>
                  )}
                  {sp.status === 'INJ' && (
                    <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>INJ Q{sp.injuryQuarter}</Text>
                    </View>
                  )}
                  {sp.isNewPlayer && !sp.status && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.playerMeta}>
                  {[sp.position, sp.representingTeam || sp.player.team].filter(Boolean).join(' · ')}
                </Text>
                {sp.representingTeam && sp.representingTeam !== sp.player.team && (
                  <Text style={styles.repTeamBadge}>
                    🏟️ Representing: {sp.representingTeam}
                  </Text>
                )}
                {/* Position timeline */}
                {(() => {
                  const posTimeline = sp.quarterData.map((qd) => ({
                    quarter: qd.quarter,
                    position: qd.position || sp.position || null,
                  }));
                  const hasPerQuarterPositions = sp.quarterData.some((qd) => qd.position);
                  const hasPositionChanges = posTimeline.some(
                    (p) => p.position && p.position !== (sp.position || posTimeline[0]?.position),
                  );
                  if (!hasPerQuarterPositions && !sp.position) return null;
                  return (
                    <View style={styles.positionTimeline}>
                      {posTimeline.map((p) => {
                        const isChanged = p.position !== sp.position && p.position !== null;
                        return (
                          <View key={p.quarter} style={[styles.posTimelineItem, isChanged && styles.posTimelineItemChanged]}>
                            <Text style={styles.posTimelineQ}>Q{p.quarter}</Text>
                            <Text style={[styles.posTimelinePos, isChanged && styles.posTimelinePosChanged]}>
                              {p.position || '—'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
              {overallRating !== null && (
                <View style={[styles.overallBadge, { borderColor: ratingColor(overallRating) + '66' }]}>
                  <Text style={[styles.overallValue, { color: ratingColor(overallRating) }]}>
                    {overallRating.toFixed(1)}
                  </Text>
                  <Text style={[styles.overallMax, { color: ratingColor(overallRating) + '99' }]}>/5.0</Text>
                  <Text style={styles.overallLabel}>OVERALL</Text>
                </View>
              )}
            </View>

            {/* DNP / INJ info banner */}
            {sp.status === 'DNP' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                <Ionicons name="close-circle" size={16} color="#EF4444" />
                <Text style={{ color: Colors.textSecondary, fontSize: 12, flex: 1 }}>Did not play — excluded from analysis and reports.</Text>
              </View>
            )}
            {sp.status === 'INJ' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' }}>
                <Ionicons name="medkit" size={16} color="#F59E0B" />
                <Text style={{ color: Colors.textSecondary, fontSize: 12, flex: 1 }}>
                  Injured in Q{sp.injuryQuarter}. Only pre-injury data used in analysis.{sp.injuryNotes ? ` Notes: ${sp.injuryNotes}` : ''}
                </Text>
              </View>
            )}

            {/* Goals by Quarter */}
            <View style={styles.goalsSection}>
              <Text style={styles.miniLabel}>⚽ GOALS BY QUARTER</Text>
              <View style={styles.goalsRow}>
                {[1, 2, 3, 4].map((q) => {
                  const qd = sp.quarterData.find((d) => d.quarter === q);
                  const goals = qd?.goals || 0;
                  return (
                    <View key={q} style={styles.goalCell}>
                      <Text style={styles.goalQLabel}>Q{q}</Text>
                      <Text style={[styles.goalValue, goals > 0 && { color: Colors.orange }]}>
                        {goals}
                      </Text>
                    </View>
                  );
                })}
                <View style={[styles.goalCell, styles.goalTotalCell]}>
                  <Text style={styles.goalQLabel}>Total</Text>
                  <Text style={[styles.goalValue, { color: Colors.orange, fontSize: 18 }]}>
                    {totalGoals}.{totalBehinds}
                  </Text>
                </View>
              </View>
            </View>

            {/* Per-Quarter Edit Buttons (edit mode only) */}
            {editMode && (
              <View style={styles.quarterEditSection}>
                <Text style={styles.miniLabel}>✏️ EDIT QUARTER DATA</Text>
                <View style={styles.quarterEditRow}>
                  {[1, 2, 3, 4].map((q) => (
                    <TouchableOpacity
                      key={q}
                      style={styles.quarterEditBtn}
                      onPress={() => navigateToQuarterEdit(sp.playerId, q)}
                    >
                      <Ionicons name="create-outline" size={14} color={Colors.accent} />
                      <Text style={styles.quarterEditBtnText}>Q{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Trait Rating Bars */}
            <View style={styles.traitSection}>
              <Text style={styles.miniLabel}>📊 TRAIT RATINGS (AVG. ALL QUARTERS)</Text>
              {TRAITS.map((trait) => {
                const totalPos = sp.quarterData.reduce((s, q) => s + ((q as any)[trait.posKey] || 0), 0);
                const totalNeg = sp.quarterData.reduce((s, q) => s + ((q as any)[trait.negKey] || 0), 0);
                const rating = calcTraitRating(totalPos, totalNeg);
                if (rating === null && totalPos + totalNeg === 0) return null;
                const displayRating = rating ?? 0;
                const barWidth = (displayRating / 5) * 100;

                return (
                  <View key={trait.posKey} style={styles.traitBarRow}>
                    <Text style={styles.traitBarLabel}>{trait.label}</Text>
                    <View style={styles.traitBarTrack}>
                      <View
                        style={[
                          styles.traitBarFill,
                          {
                            width: `${barWidth}%` as any,
                            backgroundColor: ratingColor(displayRating),
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.traitBarValue, { color: ratingColor(displayRating) }]}>
                      {displayRating.toFixed(1)}
                    </Text>
                  </View>
                );
              })}

              {/* Athletic trait bars — read from end-of-game game-level ratings */}
              {SLIDER_TRAITS.map((st) => {
                const val = athleticRatings[sp.playerId]?.[st.key] ?? ((sp as any)[st.key] as number | null);
                if (val == null) return null;
                const barWidth = (val / 5) * 100;

                return (
                  <View key={st.key} style={styles.traitBarRow}>
                    <Text style={styles.traitBarLabel}>{st.icon} {st.label}</Text>
                    <View style={styles.traitBarTrack}>
                      <View
                        style={[
                          styles.traitBarFill,
                          {
                            width: `${barWidth}%` as any,
                            backgroundColor: ratingColor(val),
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.traitBarValue, { color: ratingColor(val) }]}>
                      {val.toFixed(1)}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* End-of-Game Athletic Traits Rating (mandatory for non-DNP players) */}
            {sp.status !== 'DNP' && session.status !== 'COMPLETED' && (
              <View style={styles.athleticSection}>
                <View style={styles.athleticHeaderRow}>
                  <Text style={styles.athleticSectionTitle}>🏃 Rate Athletic Traits</Text>
                  <Text style={styles.athleticRequired}>Required</Text>
                </View>
                <Text style={styles.athleticSectionHint}>
                  Rated once for the full game (1.0–5.0). All three are required before you can finalise.
                </Text>

                {SLIDER_TRAITS.map((st) => {
                  const currentVal = athleticRatings[sp.playerId]?.[st.key] ?? null;
                  const STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
                  const isSaving = savingRating === `${sp.playerId}:${st.key}`;
                  return (
                    <View key={st.key} style={styles.athleticCard}>
                      <View style={styles.athleticTraitHeader}>
                        <Text style={styles.athleticLabel}>{st.icon} {st.label}</Text>
                        {currentVal != null ? (
                          <View style={[styles.athleticBadge, { backgroundColor: ratingBg(currentVal) }]}>
                            <Text style={[styles.athleticBadgeText, { color: ratingColor(currentVal) }]}>
                              {currentVal.toFixed(1)} / 5
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.athleticNotRated}>Not rated</Text>
                        )}
                      </View>
                      <Text style={styles.athleticDescription}>{st.description}</Text>
                      <View style={styles.athleticSteps}>
                        {STEPS.map((step) => (
                          <TouchableOpacity
                            key={step}
                            disabled={isSaving}
                            style={[
                              styles.athleticStep,
                              currentVal === step && styles.athleticStepActive,
                            ]}
                            onPress={() => setAthleticRating(sp.playerId, st.key, step)}
                          >
                            <Text
                              style={[
                                styles.athleticStepText,
                                currentVal === step && styles.athleticStepTextActive,
                              ]}
                            >
                              {Number.isInteger(step) ? step.toString() : step.toFixed(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Combined Session Notes */}
            {allNotes.length > 0 && (
              <View style={styles.notesSection}>
                <TouchableOpacity
                  style={styles.notesToggle}
                  onPress={() =>
                    setNotesExpanded((prev) => ({ ...prev, [sp.id]: !isExpanded }))
                  }
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                      size={12}
                      color={Colors.textMuted}
                    />
                    <Text style={styles.notesToggleLabel}>SCOUT NOTES ({allNotes.length} quarters)</Text>
                  </View>
                  <Text style={styles.notesToggleCount}>{allNotes.length} entries</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.notesList}>
                    {allNotes.map((n) => (
                      <View key={n.quarter} style={styles.noteItem}>
                        <Text
                          style={[
                            styles.noteQLabel,
                            n.quarter === 1 && { color: Colors.orange },
                          ]}
                        >
                          Q{n.quarter}
                        </Text>
                        <Text style={styles.noteText}>{n.notes}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Sync status */}
      <SyncStatusBadge />

      {/* ─── Actions for ACTIVE sessions ─── */}
      {session.status === 'ACTIVE' && (
        <>
          <TouchableOpacity
            style={styles.backToTrackingBtn}
            onPress={() =>
              router.replace(`/live-scouting/tracking?sessionId=${sessionId}` as any)
            }
          >
            <Ionicons name="play" size={18} color={Colors.accent} />
            <Text style={styles.backToTrackingText}>Back to Live Tracking</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.completeBtn} onPress={handleComplete} disabled={completing}>
            {completing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={20} color="#fff" />
                <Text style={styles.completeBtnText}>Complete Session</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* ─── Phase 2 Actions for COMPLETED sessions ─── */}
      {session.status === 'COMPLETED' && (
        <View style={styles.phase2Actions}>
          <Text style={styles.phase2Title}>Session Actions</Text>

          {/* Generate AI Analysis - PRIMARY CTA */}
          <TouchableOpacity
            style={styles.aiAnalysisBtn}
            onPress={() =>
              router.push(`/live-scouting/ai-analysis?sessionId=${sessionId}` as any)
            }
          >
            <View style={styles.aiAnalysisBtnInner}>
              <Ionicons name="sparkles" size={22} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.aiAnalysisBtnTitle}>
                  {session.aiSummary ? '🤖 View AI Analysis' : '🤖 Generate AI Analysis'}
                </Text>
                <Text style={styles.aiAnalysisBtnDesc}>
                  {session.aiSummary
                    ? 'View performance insights and recommendations'
                    : 'AI-powered analysis of session data & notes'}
                </Text>
              </View>
              {session.aiSummary && (
                <Ionicons name="checkmark-circle" size={20} color="#4ade80" />
              )}
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
            </View>
          </TouchableOpacity>

          {/* Export PDF */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={async () => {
              if (!sessionId) return;
              setExporting(true);
              try {
                const token = await getToken();
                const url = liveScoutingApi.exportPdfUrl(sessionId);
                if (Platform.OS === 'web') {
                  const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const blob = await res.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  window.open(blobUrl, '_blank');
                } else {
                  await Linking.openURL(url);
                }
              } catch (err: any) {
                const msg = err?.message || 'Export failed';
                Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Ionicons name="document-text-outline" size={20} color={Colors.accent} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.actionBtnTitle}>📄 Export PDF</Text>
              <Text style={styles.actionBtnDesc}>Download session report as PDF</Text>
            </View>
            <Ionicons name="download-outline" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Convert to Report */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={async () => {
              if (!sessionId) return;
              const hasExisting = !!session.convertedReportId;

              const doConvert = async () => {
                setConverting(true);
                try {
                  const result = await liveScoutingApi.convertToReport(sessionId, hasExisting);
                  if (result.alreadyConverted) {
                    const msg = 'Reports already up to date.';
                    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Info', msg);
                  } else if (result.updated) {
                    const msg = `Updated ${result.updatedCount} report(s) with latest data!`;
                    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Reports Updated', msg);
                  } else {
                    const msg = `Created ${result.playerCount} report(s) successfully!`;
                    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
                  }
                  loadSession();
                } catch (err: any) {
                  const msg = err?.message || 'Conversion failed';
                  Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
                } finally {
                  setConverting(false);
                }
              };

              if (hasExisting) {
                if (Platform.OS === 'web') {
                  if (window.confirm('Update existing ScoutPro reports with the latest session/AI data?')) {
                    doConvert();
                  }
                } else {
                  Alert.alert(
                    'Update Reports',
                    'Update existing ScoutPro reports with the latest session/AI data?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Update', onPress: doConvert },
                    ],
                  );
                }
              } else {
                doConvert();
              }
            }}
            disabled={converting}
          >
            {converting ? (
              <ActivityIndicator size="small" color={Colors.green} />
            ) : (
              <Ionicons name={session.convertedReportId ? 'sync-outline' : 'copy-outline'} size={20} color={Colors.green} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.actionBtnTitle}>
                {session.convertedReportId ? '📋 Update ScoutPro Reports' : '📋 Create ScoutPro Report'}
              </Text>
              <Text style={styles.actionBtnDesc}>
                {session.convertedReportId
                  ? 'Update reports with latest AI analysis'
                  : 'Save to player profiles from session data'}
              </Text>
            </View>
            {session.convertedReportId && (
              <Ionicons name="checkmark-circle" size={18} color={Colors.green} />
            )}
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Profile Update Suggestions */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              router.push(`/live-scouting/profile-updates?sessionId=${sessionId}` as any)
            }
          >
            <Ionicons name="person-circle-outline" size={20} color={Colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionBtnTitle}>👤 Profile Update Suggestions</Text>
              <Text style={styles.actionBtnDesc}>Review & apply player profile changes</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
      {/* ─── Edit Info Modal ─── */}
      <Modal visible={showEditInfo} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Game Info</Text>

            <Text style={styles.modalLabel}>Game Title</Text>
            <TextInput
              style={styles.modalInput}
              value={editFields.gameTitle}
              onChangeText={(t) => setEditFields((f) => ({ ...f, gameTitle: t }))}
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.modalLabel}>Home Team</Text>
            <TextInput
              style={styles.modalInput}
              value={editFields.homeTeam}
              onChangeText={(t) => setEditFields((f) => ({ ...f, homeTeam: t }))}
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.modalLabel}>Away Team</Text>
            <TextInput
              style={styles.modalInput}
              value={editFields.awayTeam}
              onChangeText={(t) => setEditFields((f) => ({ ...f, awayTeam: t }))}
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.modalLabel}>Venue</Text>
            <TextInput
              style={styles.modalInput}
              value={editFields.venue}
              onChangeText={(t) => setEditFields((f) => ({ ...f, venue: t }))}
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.modalLabel}>Competition</Text>
            <TextInput
              style={styles.modalInput}
              value={editFields.competition}
              onChangeText={(t) => setEditFields((f) => ({ ...f, competition: t }))}
              placeholderTextColor={Colors.textMuted}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowEditInfo(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveInfo}
                disabled={savingInfo}
              >
                {savingInfo ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: 16,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: Colors.accent, fontSize: 14, fontWeight: '600', marginTop: 2 },

  // Hero Banner
  heroBanner: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    marginBottom: 16,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  heroDesc: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  heroStats: { flexDirection: 'row', gap: 10 },
  heroStat: {
    flex: 1,
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroStatValue: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  heroStatLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },

  // Game Info
  gameInfoCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  gameInfoRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  gameInfoItem: { flex: 1 },
  gameInfoLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  gameInfoValue: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  compBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  compBadgeText: { color: Colors.orange, fontSize: 11, fontWeight: '700' },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  sectionHeaderBadge: {
    color: Colors.textSecondary,
    fontSize: 11,
    backgroundColor: Colors.elevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  // Player Card
  playerCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  playerHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  playerName: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  playerMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  repTeamBadge: {
    color: Colors.green, fontSize: 11, fontWeight: '600', marginTop: 3,
  },
  positionTimeline: {
    flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap',
  },
  posTimelineItem: {
    backgroundColor: Colors.elevated, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  posTimelineItemChanged: {
    backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)',
  },
  posTimelineQ: { color: Colors.textMuted, fontSize: 9, fontWeight: '700' },
  posTimelinePos: { color: Colors.textSecondary, fontSize: 10, fontWeight: '600' },
  posTimelinePosChanged: { color: Colors.amber, fontWeight: '700' },
  newBadge: {
    backgroundColor: Colors.green,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  overallBadge: {
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 56,
  },
  overallValue: { fontSize: 20, fontWeight: '800' },
  overallMax: { fontSize: 9, marginTop: -2 },
  overallLabel: {
    fontSize: 8,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },

  // Goals section
  goalsSection: { marginBottom: 14 },
  miniLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  goalsRow: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  goalCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: Colors.elevated,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  goalTotalCell: {
    backgroundColor: Colors.card,
    borderRightWidth: 0,
  },
  goalQLabel: { color: Colors.textMuted, fontSize: 9, marginBottom: 2 },
  goalValue: { color: Colors.text, fontSize: 15, fontWeight: '800' },

  // Trait Bars
  traitSection: { marginBottom: 14 },
  traitBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  traitBarLabel: {
    width: 100,
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  traitBarTrack: {
    flex: 1,
    height: 14,
    backgroundColor: Colors.elevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  traitBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  traitBarValue: {
    width: 32,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
  },

  // End-of-game athletic traits rating
  athleticSection: {
    marginBottom: 14,
    backgroundColor: 'rgba(99,102,241,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.25)',
    padding: 12,
  },
  athleticHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  athleticSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  athleticRequired: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  athleticSectionHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  athleticCard: {
    marginBottom: 10,
  },
  athleticTraitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  athleticLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  athleticBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  athleticBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  athleticNotRated: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  athleticDescription: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  athleticSteps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  athleticStep: {
    minWidth: 38,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
  },
  athleticStepActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  athleticStepText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  athleticStepTextActive: {
    color: '#fff',
  },

  // Notes section
  notesSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notesToggleLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  notesToggleCount: { color: Colors.textMuted, fontSize: 11 },
  notesList: { marginTop: 8, gap: 6 },
  noteItem: {
    backgroundColor: Colors.elevated,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteQLabel: {
    color: Colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  noteText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },

  // Back to tracking
  backToTrackingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: 'rgba(6,182,212,0.08)',
    marginBottom: 12,
  },
  backToTrackingText: { color: Colors.accent, fontSize: 15, fontWeight: '700' },

  // Complete button
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.green,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
  completeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Phase 2 actions
  phase2Actions: { marginTop: 16, marginBottom: 40 },
  phase2Title: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 12 },

  // AI Analysis primary CTA button
  aiAnalysisBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: Colors.orange,
  },
  aiAnalysisBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  aiAnalysisBtnTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  aiAnalysisBtnDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },

  // Action buttons
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  actionBtnTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  actionBtnDesc: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },

  // ─── Edit Mode Styles ────────────────────────────────────────────
  editModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.accent + '44',
    marginBottom: 12,
  },
  editModeBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  editModeBtnText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  editModeBtnTextActive: {
    color: '#fff',
  },

  staleAiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  staleAiText: {
    flex: 1,
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '600',
  },

  editInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  editInfoBtnText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },

  quarterEditSection: {
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
  },
  quarterEditRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quarterEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.elevated,
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.accent + '44',
  },
  quarterEditBtnText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },

  // ─── Modal Styles ────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  modalLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: Colors.elevated,
    borderRadius: 8,
    padding: 10,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    alignItems: 'center',
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalSaveBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
