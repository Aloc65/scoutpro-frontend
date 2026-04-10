import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api } from '../../src/api/client';
import { Colors } from '../../src/theme/colors';
import { Player, Ratings, GameStats, GAME_STAT_KEYS, Meeting, MEETING_TYPE_LABELS, MeetingType } from '../../src/types';
import Card from '../../src/components/Card';
import RatingBar from '../../src/components/RatingBar';
import ProjectionBadge from '../../src/components/ProjectionBadge';
import GradientButton from '../../src/components/GradientButton';
import EmptyState from '../../src/components/EmptyState';
import MeetingForm from '../../src/components/MeetingForm';
import EditPlayerForm from '../../src/components/EditPlayerForm';
import { getMeetingsByPlayer, createMeeting, updateMeeting, deleteMeeting } from '../../src/api/meetings';
import { Ionicons } from '@expo/vector-icons';

const RATING_LABELS: [keyof Ratings, string][] = [
  ['kicking', 'Kicking'], ['handball', 'Handball'], ['marking', 'Marking'],
  ['workRate', 'Work Rate'], ['decisionMaking', 'Decision Making'], ['composure', 'Composure'],
  ['speed', 'Speed'], ['agility', 'Agility'], ['defensiveEffort', 'Defensive Effort'],
  ['contestWork', 'Contest Work'], ['gameAwareness', 'Game Awareness'],
];

const MEETING_TYPE_ICONS: Record<MeetingType, string> = {
  INITIAL: 'person-add-outline',
  FOLLOW_UP: 'refresh-outline',
  CONTRACT: 'document-text-outline',
  REVIEW: 'clipboard-outline',
  OTHER: 'ellipsis-horizontal-outline',
};

const MEETING_TYPE_COLORS: Record<MeetingType, string> = {
  INITIAL: Colors.accent,
  FOLLOW_UP: Colors.primary,
  CONTRACT: Colors.amber,
  REVIEW: Colors.green,
  OTHER: Colors.textSecondary,
};

function formatDateAU(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [avgRatings, setAvgRatings] = useState<Ratings | null>(null);
  const [gameStatTotals, setGameStatTotals] = useState<GameStats | null>(null);
  const [gameStatAverages, setGameStatAverages] = useState<GameStats | null>(null);
  const [gamesWithStats, setGamesWithStats] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Edit player state
  const [editFormVisible, setEditFormVisible] = useState(false);

  // Meeting state
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingFormVisible, setMeetingFormVisible] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ player: Player; reports: any[]; averageRatings: Ratings; gameStatTotals: GameStats; gameStatAverages: GameStats; gamesWithStats: number }>(`/api/players/${id}`);
      setPlayer(d.player);
      setReports(d.reports);
      setAvgRatings(d.averageRatings);
      setGameStatTotals(d.gameStatTotals);
      setGameStatAverages(d.gameStatAverages);
      setGamesWithStats(d.gamesWithStats);
    } catch {}
  }, [id]);

  const loadMeetings = useCallback(async () => {
    try {
      const m = await getMeetingsByPlayer(id!);
      // Sort most recent first
      const sorted = [...m].sort((a, b) =>
        new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime()
      );
      setMeetings(sorted);
    } catch {
      // Meetings endpoint may not exist yet - gracefully handle
      setMeetings([]);
    }
  }, [id]);

  useEffect(() => { load(); loadMeetings(); }, [load, loadMeetings]);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadMeetings()]);
    setRefreshing(false);
  };

  const handleSaveMeeting = async (data: any) => {
    if (editingMeeting) {
      await updateMeeting(editingMeeting.id, data);
    } else {
      await createMeeting({ ...data, playerId: id });
    }
    setMeetingFormVisible(false);
    setEditingMeeting(null);
    await loadMeetings();
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setMeetingFormVisible(true);
  };

  const handleDeleteMeeting = (meeting: Meeting) => {
    const doDelete = async () => {
      try {
        await deleteMeeting(meeting.id);
        await loadMeetings();
      } catch (e: any) {
        const msg = e.message || 'Failed to delete meeting';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Error', msg);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this meeting?')) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Meeting',
        'Are you sure you want to delete this meeting?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const openAddMeeting = () => {
    setEditingMeeting(null);
    setMeetingFormVisible(true);
  };

  const handleUpdatePlayer = async (data: Partial<Player>) => {
    await api.patch(`/api/players/${id}`, data);
    await load();
    setEditFormVisible(false);
    const msg = 'Player updated successfully';
    if (Platform.OS === 'web') {
      window.alert(msg);
    } else {
      Alert.alert('Success', msg);
    }
  };

  if (!player) return null;

  return (
    <>
      <Stack.Screen options={{ title: player.fullName, headerStyle: { backgroundColor: Colors.card }, headerTintColor: Colors.text }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <Card style={{ marginBottom: 16 }}>
          <View style={styles.playerHeaderRow}>
            <Text style={[styles.name, { flex: 1 }]}>{player.fullName}</Text>
            <TouchableOpacity
              style={styles.editPlayerBtn}
              onPress={() => setEditFormVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color={Colors.accent} />
              <Text style={styles.editPlayerBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
          {player.team && <Text style={styles.info}>🏢 {player.team}</Text>}
          <Text style={styles.info}>
            {[
              player.age != null
                ? player.dateOfBirth
                  ? `${player.age}yo (DOB: ${formatDateAU(player.dateOfBirth)})`
                  : `${player.age}yo`
                : player.dateOfBirth
                  ? `DOB: ${formatDateAU(player.dateOfBirth)}`
                  : null,
              player.draftYear ? `${player.draftYear} Draft` : null,
              player.competition,
              player.dominantFoot,
              player.height ? `${player.height}cm` : null,
              player.weight ? `${player.weight}kg` : null,
            ].filter(Boolean).join(' • ')}
          </Text>
          {player.draftYear && (
            <View style={styles.draftYearBadge}>
              <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
              <Text style={styles.draftYearText}>{player.draftYear} Draft</Text>
            </View>
          )}
          {player.notes && <Text style={styles.notes}>{player.notes}</Text>}
        </Card>

        {avgRatings && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>Average Ratings</Text>
            {RATING_LABELS.map(([key, label]) => (
              <RatingBar key={key} label={label} value={avgRatings[key] as number | null} />
            ))}
          </Card>
        )}

        {/* Season Totals */}
        {gameStatTotals && gamesWithStats > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>Season Totals</Text>
            <Text style={styles.statsSubtitle}>{gamesWithStats} game{gamesWithStats !== 1 ? 's' : ''} with stats recorded</Text>
            <View style={styles.statsViewGrid}>
              {GAME_STAT_KEYS.map(([key, label]) => (
                <View key={key} style={styles.statViewItem}>
                  <Text style={styles.statViewValue}>{(gameStatTotals as any)[key] ?? 0}</Text>
                  <Text style={styles.statViewLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Per Game Averages */}
        {gameStatAverages && gamesWithStats > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>Averages Per Game</Text>
            <View style={styles.statsViewGrid}>
              {GAME_STAT_KEYS.map(([key, label]) => (
                <View key={key} style={styles.statViewItem}>
                  <Text style={[styles.statViewValue, { color: Colors.primary }]}>{(gameStatAverages as any)[key] != null ? (gameStatAverages as any)[key] : '—'}</Text>
                  <Text style={styles.statViewLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        <GradientButton title="+ Add Report for this Player" onPress={() => router.push(`/report/new?playerId=${id}`)} style={{ marginBottom: 16 }} />

        <Text style={styles.sectionTitle}>Reports ({reports.length})</Text>
        {reports.length === 0 && <EmptyState icon="document-text-outline" message="No reports yet" />}
        {reports.map((r: any) => (
          <Card key={r.id} onPress={() => router.push(`/report/${r.id}/edit`)} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.meta}>vs {r.opponent} • {new Date(r.matchDate).toLocaleDateString()}</Text>
                <Text style={styles.meta}>{r.scoutName} • {r.primaryPosition}</Text>
              </View>
              <ProjectionBadge value={r.overallProjection} />
            </View>
            {GAME_STAT_KEYS.some(([key]) => (r as any)[key] != null) && (
              <View style={styles.reportStatsRow}>
                {GAME_STAT_KEYS.filter(([key]) => (r as any)[key] != null).map(([key, label]) => (
                  <Text key={key} style={styles.reportStatChip}>{label}: {(r as any)[key]}</Text>
                ))}
              </View>
            )}
          </Card>
        ))}

        {/* ═══════════ MEETINGS SECTION ═══════════ */}
        <View style={styles.meetingsSectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              Meetings ({meetings.length})
            </Text>
          </View>
          <TouchableOpacity style={styles.addMeetingBtn} onPress={openAddMeeting} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.addMeetingBtnText}>Add Meeting</Text>
          </TouchableOpacity>
        </View>

        {meetings.length === 0 && (
          <EmptyState icon="calendar-outline" message="No meetings recorded" />
        )}

        {meetings.map((m) => (
          <Card key={m.id} style={{ marginBottom: 10 }}>
            {/* Meeting header */}
            <View style={styles.meetingHeader}>
              <View style={[styles.meetingTypeBadge, { backgroundColor: `${MEETING_TYPE_COLORS[m.meetingType]}20` }]}>
                <Ionicons
                  name={MEETING_TYPE_ICONS[m.meetingType] as any}
                  size={14}
                  color={MEETING_TYPE_COLORS[m.meetingType]}
                />
                <Text style={[styles.meetingTypeBadgeText, { color: MEETING_TYPE_COLORS[m.meetingType] }]}>
                  {MEETING_TYPE_LABELS[m.meetingType]}
                </Text>
              </View>
              <Text style={styles.meetingDate}>{formatDateAU(m.meetingDate)}</Text>
            </View>

            {/* Notes preview */}
            <Text style={styles.meetingNotes} numberOfLines={3}>
              {m.notes}
            </Text>

            {/* Meta info */}
            <View style={styles.meetingMetaRow}>
              {m.attendees && (
                <View style={styles.meetingMetaItem}>
                  <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.meetingMetaText}>{m.attendees}</Text>
                </View>
              )}
              {m.location && (
                <View style={styles.meetingMetaItem}>
                  <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.meetingMetaText}>{m.location}</Text>
                </View>
              )}
            </View>

            {m.actionItems && (
              <View style={styles.actionItemsBox}>
                <Text style={styles.actionItemsLabel}>Action Items</Text>
                <Text style={styles.actionItemsText}>{m.actionItems}</Text>
              </View>
            )}

            {/* Edit / Delete */}
            <View style={styles.meetingActions}>
              <TouchableOpacity
                style={styles.meetingActionBtn}
                onPress={() => handleEditMeeting(m)}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={16} color={Colors.accent} />
                <Text style={[styles.meetingActionText, { color: Colors.accent }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.meetingActionBtn}
                onPress={() => handleDeleteMeeting(m)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
                <Text style={[styles.meetingActionText, { color: Colors.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        {/* Return to Main Menu */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)/dashboard')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Meeting Form Modal */}
      <MeetingForm
        visible={meetingFormVisible}
        meeting={editingMeeting}
        onSave={handleSaveMeeting}
        onClose={() => { setMeetingFormVisible(false); setEditingMeeting(null); }}
      />

      {/* Edit Player Modal */}
      <EditPlayerForm
        visible={editFormVisible}
        player={player}
        onSave={handleUpdatePlayer}
        onClose={() => setEditFormVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  playerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  editPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6,182,212,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.25)',
  },
  editPlayerBtnText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  name: { fontSize: 22, fontWeight: '800', color: Colors.text },
  info: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  draftYearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    gap: 5,
  },
  draftYearText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
  },
  notes: { fontSize: 13, color: Colors.textMuted, marginTop: 8, fontStyle: 'italic' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  statsSubtitle: { fontSize: 13, color: Colors.textMuted, marginBottom: 12 },
  statsViewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statViewItem: { width: '30%', minWidth: 90, backgroundColor: Colors.elevated, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statViewValue: { fontSize: 22, fontWeight: '800', color: Colors.accent },
  statViewLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4, fontWeight: '600' },
  reportStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  reportStatChip: { fontSize: 11, color: Colors.accent, backgroundColor: Colors.elevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '600', overflow: 'hidden' },
  meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    marginTop: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Meetings ──
  meetingsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 4,
  },
  addMeetingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addMeetingBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  meetingTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  meetingTypeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  meetingDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  meetingNotes: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  meetingMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  meetingMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meetingMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  actionItemsBox: {
    backgroundColor: Colors.elevated,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.amber,
  },
  actionItemsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.amber,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionItemsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  meetingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  meetingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  meetingActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
