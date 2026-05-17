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
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { liveScoutingApi, LiveScoutingSession, TRAITS } from '../../src/api/liveScouting';
import { getToken } from '../../src/api/client';
import SyncStatusBadge from '../../src/components/SyncStatusBadge';

export default function SessionSummaryScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<LiveScoutingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const s = await liveScoutingApi.getSession(sessionId);
      setSession(s);
    } catch {} finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleComplete = async () => {
    if (!sessionId) return;

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

  const ratingColor = (v: number) => (v <= 2 ? Colors.error : v <= 3 ? Colors.amber : Colors.green);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>Session Summary</Text>
          <Text style={styles.subtitle}>{session.gameTitle}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Game info card */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Ionicons name="football-outline" size={16} color={Colors.accent} />
          <Text style={styles.infoText}>{session.gameTitle}</Text>
        </View>
        {session.competition && (
          <View style={styles.infoRow}>
            <Ionicons name="trophy-outline" size={16} color={Colors.amber} />
            <Text style={styles.infoText}>{session.competition}</Text>
          </View>
        )}
        {session.venue && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>{session.venue}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.infoText}>{new Date(session.gameDate).toLocaleDateString()}</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, session.status === 'COMPLETED' ? styles.statusCompleted : styles.statusActive]}>
            <Text style={styles.statusText}>{session.status}</Text>
          </View>
          <Text style={styles.playerCount}>
            {session.sessionPlayers.length} player{session.sessionPlayers.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Per-player summary */}
      {session.sessionPlayers.map((sp) => {
        const totalGoals = sp.quarterData.reduce((sum, q) => sum + q.goals, 0);
        return (
          <View key={sp.id} style={styles.playerCard}>
            <View style={styles.playerHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.playerName}>{sp.player.fullName}</Text>
                  {sp.isNewPlayer && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.playerMeta}>
                  {[sp.position, sp.player.team].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.goalsDisplay}>
                <Text style={styles.goalsValue}>{totalGoals}</Text>
                <Text style={styles.goalsLabel}>Goals</Text>
              </View>
            </View>

            {/* Quarter breakdown */}
            {sp.quarterData
              .filter((qd) => qd.goals > 0 || TRAITS.some((t) => (qd as any)[t.key] > 0) || qd.notes)
              .map((qd) => (
                <View key={qd.id} style={styles.quarterBlock}>
                  <Text style={styles.quarterTitle}>Quarter {qd.quarter}</Text>

                  {/* Counters */}
                  <View style={styles.countersRow}>
                    {qd.goals > 0 && <Text style={styles.counterChip}>⚽ {qd.goals}</Text>}
                    {TRAITS.map((t) => {
                      const val = (qd as any)[t.key];
                      return val > 0 ? (
                        <Text key={t.key} style={styles.counterChip}>
                          {t.icon} {val}
                        </Text>
                      ) : null;
                    })}
                  </View>

                  {/* Ratings */}
                  {qd.reviewCompleted && (
                    <View style={styles.ratingsRow}>
                      {TRAITS.map((t) => {
                        const val = (qd as any)[t.ratingKey];
                        return val != null ? (
                          <View key={t.ratingKey} style={styles.ratingChip}>
                            <Text style={styles.ratingLabel}>{t.label}</Text>
                            <Text style={[styles.ratingValue, { color: ratingColor(val) }]}>{val}</Text>
                          </View>
                        ) : null;
                      })}
                    </View>
                  )}

                  {/* Notes */}
                  {qd.notes ? (
                    <Text style={styles.notesText}>📝 {qd.notes}</Text>
                  ) : null}
                </View>
              ))}
          </View>
        );
      })}

      {/* Sync status */}
      <SyncStatusBadge />

      {/* Actions for ACTIVE sessions */}
      {session.status === 'ACTIVE' && (
        <>
          <TouchableOpacity
            style={styles.backToTrackingBtn}
            onPress={() => router.replace(`/live-scouting/tracking?sessionId=${sessionId}` as any)}
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

      {/* Phase 2 Actions for COMPLETED sessions */}
      {session.status === 'COMPLETED' && (
        <View style={styles.phase2Actions}>
          <Text style={styles.phase2Title}>Session Actions</Text>

          {/* AI Analysis */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/live-scouting/ai-analysis?sessionId=${sessionId}` as any)}
          >
            <Ionicons name="sparkles" size={20} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionBtnTitle}>🤖 AI Analysis</Text>
              <Text style={styles.actionBtnDesc}>
                {session.aiSummary ? 'View analysis results' : 'Generate AI insights from session data'}
              </Text>
            </View>
            {session.aiSummary && <Ionicons name="checkmark-circle" size={18} color={Colors.green} />}
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
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
                  // Open PDF in new tab with auth
                  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                  const blob = await res.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  window.open(blobUrl, '_blank');
                } else {
                  // On native, use Linking
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
              setConverting(true);
              try {
                const result = await liveScoutingApi.convertToReport(sessionId);
                if (result.alreadyConverted) {
                  const msg = 'Session already converted to report.';
                  Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Info', msg);
                } else {
                  const msg = `Created ${result.playerCount} report(s) successfully!`;
                  Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
                }
                // Reload to show linked report
                loadSession();
              } catch (err: any) {
                const msg = err?.message || 'Conversion failed';
                Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
              } finally {
                setConverting(false);
              }
            }}
            disabled={converting || !!session.convertedReportId}
          >
            {converting ? (
              <ActivityIndicator size="small" color={Colors.green} />
            ) : (
              <Ionicons name="copy-outline" size={20} color={Colors.green} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.actionBtnTitle}>📋 Create ScoutPro Report</Text>
              <Text style={styles.actionBtnDesc}>
                {session.convertedReportId ? 'Report already created' : 'Pre-fill report from session data'}
              </Text>
            </View>
            {session.convertedReportId && <Ionicons name="checkmark-circle" size={18} color={Colors.green} />}
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Profile Update Suggestions */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/live-scouting/profile-updates?sessionId=${sessionId}` as any)}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, maxWidth: 650, alignSelf: 'center', width: '100%', paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

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

  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoText: { color: Colors.text, fontSize: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusActive: { backgroundColor: 'rgba(6,182,212,0.15)' },
  statusCompleted: { backgroundColor: 'rgba(16,185,129,0.15)' },
  statusText: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  playerCount: { color: Colors.textSecondary, fontSize: 13 },

  playerCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  playerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  playerName: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  playerMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  newBadge: { backgroundColor: Colors.green, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  newBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  goalsDisplay: { alignItems: 'center' },
  goalsValue: { color: Colors.text, fontSize: 24, fontWeight: '800' },
  goalsLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },

  quarterBlock: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 8 },
  quarterTitle: { color: Colors.accent, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  countersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  counterChip: {
    color: Colors.text,
    fontSize: 12,
    backgroundColor: Colors.elevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  ratingsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.elevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  ratingValue: { fontSize: 13, fontWeight: '800' },
  notesText: { color: Colors.textSecondary, fontSize: 13, fontStyle: 'italic', marginTop: 4 },

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

  // Phase 2 action buttons
  phase2Actions: { marginTop: 16, marginBottom: 40 },
  phase2Title: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 12 },
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
});
