import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/theme/colors';
import { DashboardData, UpcomingGame } from '../../src/types';
import Card from '../../src/components/Card';
import ProjectionBadge from '../../src/components/ProjectionBadge';
import GradientButton from '../../src/components/GradientButton';

/** Group games by their display date string */
function groupByDate(games: UpcomingGame[]): Record<string, UpcomingGame[]> {
  const groups: Record<string, UpcomingGame[]> = {};
  for (const g of games) {
    if (!groups[g.date]) groups[g.date] = [];
    groups[g.date].push(g);
  }
  return groups;
}

/* ── Compact game row for desktop widget ── */
function CompactGameRow({ game, onPress }: { game: UpcomingGame; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={cs.row}>
      <View style={cs.rowLeft}>
        <View style={cs.compChip}>
          <Text style={cs.compChipText} numberOfLines={1}>{game.competition}</Text>
        </View>
        <Text style={cs.rowTeams} numberOfLines={1}>
          {game.homeTeam} <Text style={cs.rowVs}>vs</Text> {game.awayTeam}
          {game.venue ? <Text style={cs.rowVenue}> @ {game.venue}</Text> : null}
        </Text>
      </View>
      <View style={cs.rowRight}>
        <Text style={cs.rowTime}>{game.time || 'TBC'}</Text>
        {game.sessionId ? (
          <Ionicons name="radio" size={12} color={Colors.green} style={{ marginLeft: 6 }} />
        ) : (
          <Ionicons name="add-circle-outline" size={12} color={Colors.textMuted} style={{ marginLeft: 6 }} />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const load = useCallback(async () => {
    try {
      const d = await api.get<DashboardData>('/api/dashboard');
      setData(d);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const upcoming = data?.upcomingGames;
  const gameGroups = upcoming?.games ? groupByDate(upcoming.games) : {};

  const statItems: [string, string, number | undefined][] = [
    ['people', 'Total Players', data?.totalPlayers],
    ['document-text', 'Total Reports', data?.totalReports],
    ['person', 'My Reports', data?.myReports],
  ];

  /* ── Desktop: compact upcoming games card ── */
  const upcomingGamesCompactCard = (
    <Card style={[cs.widget, isDesktop && { flex: 1 }]}>
      <View style={cs.widgetHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="calendar" size={16} color={Colors.accent} />
          <Text style={cs.widgetTitle}>Upcoming Games</Text>
        </View>
        {upcoming?.totalGames != null && (
          <View style={cs.countBadge}>
            <Text style={cs.countBadgeText}>{upcoming.totalGames}</Text>
          </View>
        )}
      </View>
      {upcoming?.weekendLabel ? (
        <Text style={cs.widgetSub}>{upcoming.weekendLabel}</Text>
      ) : null}

      {upcoming && upcoming.totalGames === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Ionicons name="football-outline" size={28} color={Colors.textMuted} />
          <Text style={cs.emptyText}>No games this weekend</Text>
        </View>
      ) : (
        <ScrollView style={cs.gamesList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {Object.entries(gameGroups).map(([dateLabel, games]) => (
            <View key={dateLabel}>
              <Text style={cs.dateLabel}>{dateLabel}</Text>
              {games.map((game) => (
                <CompactGameRow
                  key={game.id}
                  game={game}
                  onPress={() => router.push(game.sessionId ? '/live-scouting/sessions' : '/live-scouting/new-session')}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </Card>
  );

  /* ── Full expanded game card (mobile only) ── */
  const renderFullGameCard = (game: UpcomingGame) => (
    <Card
      key={game.id}
      style={styles.gameCard}
      onPress={() => router.push(game.sessionId ? '/live-scouting/sessions' : '/live-scouting/new-session')}
    >
      <View style={styles.gameTopRow}>
        <View style={styles.compBadge}>
          <Text style={styles.compBadgeText}>{game.competition}</Text>
        </View>
        {game.round ? <Text style={styles.roundText}>{game.round}</Text> : null}
      </View>
      <View style={styles.teamsRow}>
        <Text style={styles.teamName}>{game.homeTeam}</Text>
        <Text style={styles.vsText}>vs</Text>
        <Text style={styles.teamName}>{game.awayTeam}</Text>
      </View>
      <View style={styles.gameDetailsRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.venueText} numberOfLines={1}>{game.venue || 'TBC'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.timeText}>{game.time || 'TBC'}</Text>
        </View>
      </View>
      <View style={styles.sessionRow}>
        {game.sessionId ? (
          <View style={styles.sessionActive}>
            <Ionicons name="radio" size={14} color={Colors.green} />
            <Text style={styles.sessionActiveText}>
              {game.sessionStatus === 'ACTIVE' ? 'Live Session' : 'Session Created'} • {game.playerCount} player{game.playerCount !== 1 ? 's' : ''}
            </Text>
          </View>
        ) : (
          <View style={styles.sessionCreate}>
            <Ionicons name="add-circle-outline" size={14} color={Colors.accent} />
            <Text style={styles.sessionCreateText}>Create Session</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
    </Card>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32, maxWidth: 1200, alignSelf: 'center' as any, width: '100%' as any }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      <Text style={styles.greeting}>Hello, {user?.name} 👋</Text>

      {/* ── Desktop grid: stat cards + upcoming games side-by-side ── */}
      {isDesktop ? (
        <View style={cs.grid}>
          {/* Left column: stat cards stacked */}
          <View style={cs.statsCol}>
            {statItems.map(([icon, label, count], i) => (
              <Card key={i} style={cs.statBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={icon as any} size={20} color={Colors.accent} />
                  <Text style={cs.statBoxLabel}>{label}</Text>
                </View>
                <Text style={cs.statBoxCount}>{count ?? '-'}</Text>
              </Card>
            ))}
          </View>

          {/* Right column: compact upcoming games */}
          {upcomingGamesCompactCard}
        </View>
      ) : (
        <>
          {/* Mobile: horizontal stat cards */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
            {statItems.map(([icon, label, count], i) => (
              <Card key={i} style={[styles.statCard, i > 0 && { marginLeft: 12 }]}>
                <Ionicons name={icon as any} size={24} color={Colors.accent} />
                <Text style={styles.statCount}>{count ?? '-'}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </Card>
            ))}
          </ScrollView>
        </>
      )}

      <GradientButton title="+ Quick Add Report" onPress={() => router.push('/report/new')} style={{ marginBottom: 24 }} />

      {/* ── Mobile: full upcoming games cards ── */}
      {!isDesktop && (
        <>
          <View style={styles.upcomingHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="calendar" size={20} color={Colors.accent} />
              <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>Upcoming Games</Text>
            </View>
            {upcoming?.weekendLabel ? (
              <Text style={styles.weekendLabel}>{upcoming.weekendLabel}</Text>
            ) : null}
          </View>

          {upcoming && upcoming.totalGames === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Ionicons name="football-outline" size={36} color={Colors.textMuted} />
                <Text style={{ fontSize: 14, color: Colors.textMuted, marginTop: 8 }}>No games scheduled for this weekend</Text>
              </View>
            </Card>
          ) : (
            Object.entries(gameGroups).map(([dateLabel, games]) => (
              <View key={dateLabel} style={{ marginBottom: 12 }}>
                <Text style={styles.dateGroupLabel}>{dateLabel}</Text>
                {games.map(renderFullGameCard)}
              </View>
            ))
          )}
          <View style={{ marginTop: 12 }} />
        </>
      )}

      <Text style={styles.sectionTitle}>Recent Reports</Text>
      {data?.recentReports?.map((r) => (
        <Card key={r.id} onPress={() => router.push(`/report/${r.id}/edit`)} style={styles.reportCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerName}>{r.playerName}</Text>
              <Text style={styles.meta}>vs {r.opponent} • {new Date(r.matchDate).toLocaleDateString()}</Text>
              <Text style={styles.meta}>{r.scoutName}</Text>
            </View>
            <ProjectionBadge value={r.overallProjection} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

/* ── Compact / Desktop styles ── */
const cs = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  statsCol: { width: 200, gap: 10 },
  statBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  statBoxLabel: { fontSize: 13, color: Colors.textSecondary, marginLeft: 8, fontWeight: '500' },
  statBoxCount: { fontSize: 24, fontWeight: '800', color: Colors.text },

  widget: { padding: 16 },
  widgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  widgetTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginLeft: 6 },
  widgetSub: { fontSize: 11, color: Colors.textMuted, marginBottom: 10 },
  countBadge: { backgroundColor: Colors.accent + '25', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.accent },

  gamesList: { maxHeight: 260 },
  dateLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', marginTop: 8, marginBottom: 4, letterSpacing: 0.5 },
  emptyText: { fontSize: 13, color: Colors.textMuted, marginTop: 6 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 8, borderRadius: 8, marginBottom: 2 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  compChip: { backgroundColor: Colors.primary + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginRight: 8, maxWidth: 80 },
  compChipText: { fontSize: 9, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase' },
  rowTeams: { fontSize: 13, color: Colors.text, fontWeight: '600', flex: 1 },
  rowVs: { color: Colors.textMuted, fontWeight: '400', fontSize: 11 },
  rowVenue: { color: Colors.textMuted, fontWeight: '400', fontSize: 11 },
  rowRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  rowTime: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
});

/* ── Original / Mobile styles ── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  greeting: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 20 },
  statCard: { width: 140, alignItems: 'center', paddingVertical: 20 },
  statCount: { fontSize: 28, fontWeight: '800', color: Colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  reportCard: { marginBottom: 12 },
  playerName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  upcomingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  weekendLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  dateGroupLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8, marginTop: 4 },
  emptyCard: { marginBottom: 20 },
  gameCard: { marginBottom: 10, padding: 14 },
  gameTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  compBadge: { backgroundColor: Colors.primary + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  compBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase' },
  roundText: { fontSize: 12, color: Colors.textSecondary, marginLeft: 8 },
  teamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  teamName: { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1 },
  vsText: { fontSize: 13, color: Colors.textMuted, marginHorizontal: 8, fontWeight: '600' },
  gameDetailsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  venueText: { fontSize: 12, color: Colors.textSecondary, marginLeft: 4, flex: 1, marginRight: 8 },
  timeText: { fontSize: 12, color: Colors.textSecondary, marginLeft: 4, fontWeight: '600' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  sessionActive: { flexDirection: 'row', alignItems: 'center' },
  sessionActiveText: { fontSize: 12, color: Colors.green, marginLeft: 6, fontWeight: '600' },
  sessionCreate: { flexDirection: 'row', alignItems: 'center' },
  sessionCreateText: { fontSize: 12, color: Colors.accent, marginLeft: 6, fontWeight: '600' },
});