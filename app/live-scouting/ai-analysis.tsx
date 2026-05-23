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
  AiAnalysis,
  AiAnalysisPlayer,
  TRAITS,
  calcTraitRating,
} from '../../src/api/liveScouting';

function ratingColor(v: number) {
  return v >= 4 ? '#10B981' : v >= 3 ? '#F59E0B' : '#EF4444';
}

function ratingBg(v: number) {
  return v >= 4 ? 'rgba(16,185,129,0.1)' : v >= 3 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
}

export default function AiAnalysisScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<LiveScoutingSession | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedPlayerIdx, setSelectedPlayerIdx] = useState(0);
  const [savingReports, setSavingReports] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    strengths: true,
    development: true,
    traits: true,
    recommendations: true,
  });

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const s = await liveScoutingApi.getSession(sessionId);
      setSession(s);
      if (s.aiSummary) {
        setAnalysis({
          summary: s.aiSummary,
          players: (s.aiPlayers as AiAnalysisPlayer[]) || [],
          strengths: (s.aiStrengths as any[]) || [],
          weaknesses: (s.aiWeaknesses as any[]) || [],
          suggestedRatings: (s.aiSuggestedRatings as Record<string, number>) || {},
          analyzedAt: s.aiAnalyzedAt || null,
        });
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const runAnalysis = async () => {
    if (!sessionId) return;
    setAnalyzing(true);
    try {
      const result = await liveScoutingApi.analyzeSession(sessionId);
      setAnalysis(result);
      const msg = 'AI analysis completed successfully!';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err?.message || 'AI analysis failed';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const currentPlayer =
    analysis?.players && analysis.players.length > 0
      ? analysis.players[selectedPlayerIdx]
      : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="sparkles" size={16} color={Colors.orange} />
            <Text style={styles.title}>AI Analysis</Text>
          </View>
          <Text style={styles.subtitle}>{session?.gameTitle || 'Session'}</Text>
        </View>
        {analysis && (
          <View style={styles.completeBadge}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.green} />
            <Text style={styles.completeBadgeText}>Complete</Text>
          </View>
        )}
        {!analysis && <View style={{ width: 60 }} />}
      </View>

      {/* ─── Empty State: Run Analysis ─── */}
      {!analysis && !analyzing && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="sparkles-outline" size={48} color={Colors.orange} />
          </View>
          <Text style={styles.emptyTitle}>Ready to Analyze</Text>
          <Text style={styles.emptyDesc}>
            AI will synthesize your quarter notes, trait observations, and scoring data into a
            comprehensive performance analysis with strengths, development areas, and
            actionable recommendations.
          </Text>
          <TouchableOpacity style={styles.runAnalysisBtn} onPress={runAnalysis}>
            <Ionicons name="flash" size={22} color="#fff" />
            <Text style={styles.runAnalysisBtnText}>Generate AI Analysis</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Analyzing Progress ─── */}
      {analyzing && (
        <View style={styles.progressCard}>
          <ActivityIndicator size="large" color={Colors.orange} />
          <Text style={styles.progressTitle}>Analyzing Session Data...</Text>
          <Text style={styles.progressDesc}>
            Synthesizing notes, trait observations, and scoring across all quarters and
            players...
          </Text>
          <View style={styles.progressSteps}>
            {[
              { icon: '📊', text: 'Processing trait observations' },
              { icon: '📝', text: 'Reading quarter notes' },
              { icon: '🧠', text: 'Generating performance insights' },
              { icon: '💡', text: 'Building recommendations' },
            ].map((step, i) => (
              <View key={i} style={styles.progressStep}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.progressStepText}>
                  {step.icon} {step.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ─── Analysis Results ─── */}
      {analysis && !analyzing && (
        <>
          {/* Player Switcher */}
          {analysis.players && analysis.players.length > 1 && (
            <View style={styles.playerSwitcher}>
              <TouchableOpacity
                style={styles.playerSwitcherArrow}
                onPress={() =>
                  setSelectedPlayerIdx((prev) =>
                    prev > 0 ? prev - 1 : analysis.players.length - 1,
                  )
                }
              >
                <Ionicons name="chevron-back" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.playerSwitcherCenter}>
                <View style={styles.playerAvatar}>
                  <Text style={styles.playerAvatarText}>
                    {currentPlayer?.playerName
                      ?.split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || '??'}
                  </Text>
                </View>
                <Text style={styles.playerSwitcherName}>
                  {currentPlayer?.playerName || 'Unknown'}
                </Text>
                <Text style={styles.playerSwitcherMeta}>
                  {currentPlayer?.position || 'N/A'} · {selectedPlayerIdx + 1} / {analysis.players.length}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.playerSwitcherArrow}
                onPress={() =>
                  setSelectedPlayerIdx((prev) =>
                    prev < analysis.players.length - 1 ? prev + 1 : 0,
                  )
                }
              >
                <Ionicons name="chevron-forward" size={16} color={Colors.orange} />
              </TouchableOpacity>
            </View>
          )}

          {/* Player dot indicators */}
          {analysis.players && analysis.players.length > 1 && (
            <View style={styles.dotIndicators}>
              {analysis.players.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === selectedPlayerIdx && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}

          {/* ═══ CARD 1: Performance Summary ═══ */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionCardHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
                <Ionicons name="bulb" size={14} color={Colors.orange} />
              </View>
              <Text style={styles.sectionCardTitle}>Performance Summary</Text>
              <Text style={styles.aiBadge}>AI</Text>
            </View>
            <Text style={styles.summaryText}>
              {currentPlayer?.performanceSummary || analysis.summary}
            </Text>
            {currentPlayer?.overallRating != null && (
              <View style={styles.overallRatingRow}>
                <Text style={styles.overallRatingLabel}>Overall Rating</Text>
                <View
                  style={[
                    styles.overallRatingBadge,
                    { backgroundColor: ratingBg(currentPlayer.overallRating) },
                  ]}
                >
                  <Text
                    style={[
                      styles.overallRatingValue,
                      { color: ratingColor(currentPlayer.overallRating) },
                    ]}
                  >
                    {currentPlayer.overallRating.toFixed(1)}/5.0
                  </Text>
                </View>
              </View>
            )}
            {analysis.analyzedAt && (
              <Text style={styles.analyzedAt}>
                Analyzed {new Date(analysis.analyzedAt).toLocaleString()}
              </Text>
            )}
          </View>

          {/* ═══ CARD 2: Key Strengths ═══ */}
          {currentPlayer && currentPlayer.keyStrengths.length > 0 && (
            <View style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionCardHeaderToggle}
                onPress={() => toggleSection('strengths')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.sectionIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                    <Ionicons name="trending-up" size={14} color={Colors.green} />
                  </View>
                  <Text style={styles.sectionCardTitle}>Key Strengths</Text>
                  <View style={styles.countBadgeGreen}>
                    <Text style={styles.countBadgeGreenText}>
                      {currentPlayer.keyStrengths.length} identified
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={expandedSections.strengths ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
              {expandedSections.strengths && (
                <View style={styles.insightsList}>
                  {currentPlayer.keyStrengths.map((s, i) => (
                    <View key={i} style={styles.insightItem}>
                      <View style={styles.insightDotGreen} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.insightTitle}>{s.title}</Text>
                        <Text style={styles.insightDetail}>{s.detail}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ═══ CARD 3: Areas for Development ═══ */}
          {currentPlayer && currentPlayer.areasForDevelopment.length > 0 && (
            <View style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionCardHeaderToggle}
                onPress={() => toggleSection('development')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.sectionIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                    <Ionicons name="flag" size={14} color={Colors.amber} />
                  </View>
                  <Text style={styles.sectionCardTitle}>Areas for Development</Text>
                  <View style={styles.countBadgeAmber}>
                    <Text style={styles.countBadgeAmberText}>
                      {currentPlayer.areasForDevelopment.length} noted
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={expandedSections.development ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
              {expandedSections.development && (
                <View style={styles.insightsList}>
                  {currentPlayer.areasForDevelopment.map((d, i) => (
                    <View key={i} style={styles.insightItem}>
                      <View style={styles.insightDotAmber} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.insightTitle}>{d.title}</Text>
                        <Text style={styles.insightDetail}>{d.detail}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ═══ CARD 4: Trait Analysis ═══ */}
          {currentPlayer && currentPlayer.traitAnalysis.length > 0 && (
            <View style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionCardHeaderToggle}
                onPress={() => toggleSection('traits')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.sectionIcon, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
                    <Ionicons name="analytics" size={14} color={Colors.orange} />
                  </View>
                  <Text style={styles.sectionCardTitle}>Trait Analysis</Text>
                  <Text style={styles.aiBadge}>AI Suggested</Text>
                </View>
                <Ionicons
                  name={expandedSections.traits ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
              {expandedSections.traits && (
                <View style={styles.traitAnalysisList}>
                  {currentPlayer.traitAnalysis.map((ta, i) => {
                    const barWidth = (ta.rating / 5) * 100;
                    return (
                      <View key={i} style={styles.traitAnalysisItem}>
                        <View style={styles.traitAnalysisHeader}>
                          <Text style={styles.traitAnalysisName}>{ta.trait}</Text>
                          <View style={styles.traitAnalysisRatingRow}>
                            {/* Rating blocks */}
                            <View style={styles.ratingBlocks}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <View
                                  key={n}
                                  style={[
                                    styles.ratingBlock,
                                    {
                                      backgroundColor:
                                        n <= Math.round(ta.rating)
                                          ? ratingColor(ta.rating)
                                          : Colors.elevated,
                                      borderColor:
                                        n <= Math.round(ta.rating)
                                          ? 'transparent'
                                          : Colors.border,
                                    },
                                  ]}
                                />
                              ))}
                            </View>
                            <Text
                              style={[
                                styles.traitAnalysisRating,
                                { color: ratingColor(ta.rating) },
                              ]}
                            >
                              {ta.rating.toFixed(1)}/5
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.traitAnalysisText}>{ta.analysis}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ═══ CARD 5: Recommendations ═══ */}
          {currentPlayer && currentPlayer.recommendations.length > 0 && (
            <View style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionCardHeaderToggle}
                onPress={() => toggleSection('recommendations')}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.sectionIcon, { backgroundColor: 'rgba(6,182,212,0.12)' }]}>
                    <Ionicons name="bulb-outline" size={14} color={Colors.accent} />
                  </View>
                  <Text style={styles.sectionCardTitle}>Recommendations</Text>
                  <View style={styles.countBadgeCyan}>
                    <Text style={styles.countBadgeCyanText}>
                      {currentPlayer.recommendations.length} items
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={expandedSections.recommendations ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
              {expandedSections.recommendations && (
                <View style={styles.recommendationsList}>
                  {currentPlayer.recommendations.map((rec, i) => (
                    <View key={i} style={styles.recommendationItem}>
                      <View style={styles.recommendationNum}>
                        <Text style={styles.recommendationNumText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.recommendationText}>{rec}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ═══ Session-wide Summary (if no per-player data) ═══ */}
          {(!currentPlayer || analysis.players.length === 0) && (
            <>
              {/* Summary */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
                    <Ionicons name="bulb" size={14} color={Colors.orange} />
                  </View>
                  <Text style={styles.sectionCardTitle}>Performance Summary</Text>
                  <Text style={styles.aiBadge}>AI</Text>
                </View>
                <Text style={styles.summaryText}>{analysis.summary}</Text>
                {analysis.analyzedAt && (
                  <Text style={styles.analyzedAt}>
                    Analyzed {new Date(analysis.analyzedAt).toLocaleString()}
                  </Text>
                )}
              </View>

              {/* Strengths */}
              {analysis.strengths.length > 0 && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionCardHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                      <Ionicons name="trending-up" size={14} color={Colors.green} />
                    </View>
                    <Text style={[styles.sectionCardTitle, { color: Colors.green }]}>Strengths</Text>
                  </View>
                  {analysis.strengths.map((s, i) => (
                    <View key={i} style={styles.legacyInsightRow}>
                      <View style={styles.legacyBadge}>
                        <Text style={[styles.legacyBadgeText, { color: Colors.green }]}>
                          {s.rating}/5
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.insightTitle}>{s.trait}</Text>
                        <Text style={styles.insightDetail}>{s.evidence}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Weaknesses */}
              {analysis.weaknesses.length > 0 && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionCardHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                      <Ionicons name="trending-down" size={14} color={Colors.error} />
                    </View>
                    <Text style={[styles.sectionCardTitle, { color: Colors.error }]}>
                      Areas for Improvement
                    </Text>
                  </View>
                  {analysis.weaknesses.map((w, i) => (
                    <View key={i} style={styles.legacyInsightRow}>
                      <View style={styles.legacyBadge}>
                        <Text style={[styles.legacyBadgeText, { color: Colors.error }]}>
                          {w.rating}/5
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.insightTitle}>{w.trait}</Text>
                        <Text style={styles.insightDetail}>{w.evidence}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Save to Player Profiles — PRIMARY CTA */}
          <TouchableOpacity
            style={[styles.saveToProfilesBtn, savingReports && styles.saveToProfilesBtnDisabled]}
            disabled={savingReports}
            onPress={async () => {
              if (!sessionId) return;
              const hasExisting = !!session?.convertedReportId;
              const doSave = async () => {
                setSavingReports(true);
                try {
                  // Always force update if reports already exist — user wants latest AI data saved
                  const result = await liveScoutingApi.convertToReport(sessionId, hasExisting);
                  if (result.alreadyConverted) {
                    const msg = 'Reports already up to date.';
                    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Info', msg);
                  } else if (result.updated) {
                    const msg = `Updated ${result.updatedCount} existing report(s) and created ${result.createdCount} new report(s) on player profiles!`;
                    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Reports Updated', msg);
                  } else {
                    const msg = `Created ${result.playerCount} ScoutPro report(s) on player profiles!`;
                    Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Reports Created', msg);
                  }
                  // Reload session to get updated convertedReportId
                  loadSession();
                } catch (err: any) {
                  const msg = err?.message || 'Failed to save reports';
                  Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
                } finally {
                  setSavingReports(false);
                }
              };

              if (hasExisting) {
                // Confirm update of existing reports
                if (Platform.OS === 'web') {
                  if (window.confirm('Update existing ScoutPro reports with the latest AI analysis? This will overwrite the current report data on each player\'s profile.')) {
                    doSave();
                  }
                } else {
                  Alert.alert(
                    'Update Reports',
                    'Update existing ScoutPro reports with the latest AI analysis? This will overwrite the current report data on each player\'s profile.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Update Reports', style: 'default', onPress: doSave },
                    ],
                  );
                }
              } else {
                doSave();
              }
            }}
          >
            {savingReports ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons
                name={session?.convertedReportId ? 'sync' : 'save'}
                size={18}
                color="#fff"
              />
            )}
            <Text style={styles.saveToProfilesText}>
              {savingReports
                ? 'Saving...'
                : session?.convertedReportId
                  ? 'Update Player Profile Reports'
                  : 'Save Reports to Player Profiles'}
            </Text>
          </TouchableOpacity>
          {session?.convertedReportId && (
            <Text style={styles.savedHint}>
              ✅ Reports already saved — tap to update with latest AI analysis
            </Text>
          )}

          {/* Regenerate button */}
          <TouchableOpacity
            style={styles.regenerateBtn}
            onPress={() => {
              const doRegenerate = () => runAnalysis();
              if (Platform.OS === 'web') {
                if (window.confirm('Regenerate AI analysis? This will replace the current report with a fresh analysis.')) {
                  doRegenerate();
                }
              } else {
                Alert.alert(
                  'Regenerate Analysis',
                  'This will replace the current report with a fresh AI analysis. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Regenerate', style: 'default', onPress: doRegenerate },
                  ],
                );
              }
            }}
          >
            <Ionicons name="refresh" size={16} color={Colors.orange} />
            <Text style={styles.regenerateText}>Regenerate Analysis</Text>
          </TouchableOpacity>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            © 2026 FFS Scouting. AI-generated — always verify with scout judgement.
          </Text>
        </>
      )}
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
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 8 },
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
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completeBadgeText: { color: Colors.green, fontSize: 10, fontWeight: '700' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  emptyDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
    maxWidth: 400,
    lineHeight: 20,
  },
  runAnalysisBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.orange,
  },
  runAnalysisBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Progress
  progressCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  progressTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
  },
  progressDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  progressSteps: { gap: 12, width: '100%', maxWidth: 300 },
  progressStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressStepText: { color: Colors.text, fontSize: 13 },

  // Player Switcher
  playerSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 10,
    marginBottom: 4,
  },
  playerSwitcherArrow: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerSwitcherCenter: { flex: 1, alignItems: 'center' },
  playerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.orange,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  playerAvatarText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  playerSwitcherName: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  playerSwitcherMeta: { color: Colors.textSecondary, fontSize: 11, marginTop: 1 },

  // Dot indicators
  dotIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 14,
    marginTop: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.elevated,
  },
  dotActive: {
    width: 20,
    backgroundColor: Colors.orange,
  },

  // Section cards
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionCardHeaderToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionCardTitle: { color: Colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  aiBadge: {
    color: Colors.orange,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Count badges
  countBadgeGreen: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeGreenText: { color: Colors.green, fontSize: 10, fontWeight: '600' },
  countBadgeAmber: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeAmberText: { color: Colors.amber, fontSize: 10, fontWeight: '600' },
  countBadgeCyan: {
    backgroundColor: 'rgba(6,182,212,0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeCyanText: { color: Colors.accent, fontSize: 10, fontWeight: '600' },

  // Summary text
  summaryText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  overallRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  overallRatingLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  overallRatingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  overallRatingValue: { fontSize: 14, fontWeight: '800' },
  analyzedAt: {
    color: Colors.textMuted,
    fontSize: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },

  // Insights lists (strengths / development)
  insightsList: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  insightItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  insightDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.green,
    marginTop: 6,
  },
  insightDotAmber: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.amber,
    marginTop: 6,
  },
  insightTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  insightDetail: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  // Trait Analysis
  traitAnalysisList: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  traitAnalysisItem: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  traitAnalysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  traitAnalysisName: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  traitAnalysisRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingBlocks: { flexDirection: 'row', gap: 2 },
  ratingBlock: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
  },
  traitAnalysisRating: { fontSize: 12, fontWeight: '800' },
  traitAnalysisText: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16 },

  // Recommendations
  recommendationsList: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  recommendationItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  recommendationNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(6,182,212,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendationNumText: { color: Colors.accent, fontSize: 11, fontWeight: '800' },
  recommendationText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  // Legacy insight rows (fallback for session-wide)
  legacyInsightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  legacyBadge: {
    backgroundColor: Colors.elevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  legacyBadgeText: { fontSize: 13, fontWeight: '800' },

  // Save to Player Profiles
  saveToProfilesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.green,
    marginBottom: 6,
  },
  saveToProfilesBtnDisabled: { opacity: 0.6 },
  saveToProfilesText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  savedHint: {
    color: Colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 14,
  },

  // Regenerate
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.orange,
    backgroundColor: 'rgba(249,115,22,0.08)',
    marginBottom: 12,
  },
  regenerateText: { color: Colors.orange, fontSize: 14, fontWeight: '700' },

  // Disclaimer
  disclaimer: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 40,
  },
});
