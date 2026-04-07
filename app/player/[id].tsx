import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api } from '../../src/api/client';
import { Colors } from '../../src/theme/colors';
import { Player, Ratings, GameStats, GAME_STAT_KEYS } from '../../src/types';
import Card from '../../src/components/Card';
import RatingBar from '../../src/components/RatingBar';
import ProjectionBadge from '../../src/components/ProjectionBadge';
import GradientButton from '../../src/components/GradientButton';
import EmptyState from '../../src/components/EmptyState';
import { Ionicons } from '@expo/vector-icons';

const RATING_LABELS: [keyof Ratings, string][] = [
  ['kicking', 'Kicking'], ['handball', 'Handball'], ['marking', 'Marking'],
  ['workRate', 'Work Rate'], ['decisionMaking', 'Decision Making'], ['composure', 'Composure'],
  ['speed', 'Speed'], ['agility', 'Agility'], ['defensiveEffort', 'Defensive Effort'],
  ['contestWork', 'Contest Work'], ['gameAwareness', 'Game Awareness'],
];

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

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

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
          <Text style={styles.name}>{player.fullName}</Text>
          {player.team && <Text style={styles.info}>🏢 {player.team}</Text>}
          <Text style={styles.info}>
            {[player.age ? `${player.age}yo` : null, player.competition, player.dominantFoot, player.height ? `${player.height}cm` : null, player.weight ? `${player.weight}kg` : null].filter(Boolean).join(' • ')}
          </Text>
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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  name: { fontSize: 22, fontWeight: '800', color: Colors.text },
  info: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
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
});
