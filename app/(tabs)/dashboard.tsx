import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/theme/colors';
import { DashboardData, UpcomingGame, FollowUpsResponse, AUSTRALIAN_STATES } from '../../src/types';
import Card from '../../src/components/Card';
import ProjectionBadge from '../../src/components/ProjectionBadge';
import GradientButton from '../../src/components/GradientButton';
import { getFollowUps } from '../../src/api/watchList';

/** Group games by their display date string */
function groupByDate(games: UpcomingGame[]): Record<string, UpcomingGame[]> {
  const groups: Record<string, UpcomingGame[]> = {};
  for (const g of games) {
    if (!groups[g.date]) groups[g.date] = [];
    groups[g.date].push(g);
  }
  return groups;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpsResponse | null>(null);
  const [followUpsScope, setFollowUpsScope] = useState<'mine' | 'all'>('mine');
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    try {
      const d = await api.get<DashboardData>('/api/dashboard');
      setData(d);
    } catch {}
  }, []);

  const loadFollowUps = useCallback(async () => {
    try {
      const f = await getFollowUps(followUpsScope);
      setFollowUps(f);
    } catch {
      setFollowUps(null);
    }
  }, [followUpsScope]);

  useEffect(() => { load(); loadFollowUps(); }, [load, loadFollowUps]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadFollowUps()]);
    setRefreshing(false);
  };

  const upcoming = data?.upcomingGames;
  const gameGroups = upcoming?.games ? groupByDate(upcoming.games) : {};

  /* ── Responsive fixtures grid ──────────────────────────────────────
   * Emulates `grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`.
   * Phone collapses to a single (tappable, full-width) column; tablet/desktop
   * flow into 2–4 columns so all games are visible at once instead of a long
   * full-width stack that scrolls for two screens. */
  const GRID_GAP = 10;
  const gridColumns = width < 600 ? 1 : width < 900 ? 2 : width < 1200 ? 3 : 4;
  const gridInnerWidth = Math.min(width, 1200) - 32; // ScrollView horizontal padding (16 each side)
  const gridCardWidth =
    gridColumns === 1
      ? '100%'
      : Math.floor((gridInnerWidth - GRID_GAP * (gridColumns - 1)) / gridColumns);

  const renderGamesGrid = (games: UpcomingGame[]) => (
    <View style={styles.gamesGrid}>
      {games.map((game) => renderFullGameCard(game, gridCardWidth))}
    </View>
  );

  /* ── Full expanded game card ── */
  const renderFullGameCard = (game: UpcomingGame, cardWidth: number | string) => (
    <Card
      key={game.id}
      style={[styles.gameCard, { width: cardWidth as any }]}
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
      contentContainerStyle={{ padding: 16, paddingBottom: 32, maxWidth: 1200, width: '100%', marginHorizontal: 'auto' as any }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      <Text style={styles.greeting}>Hello, {user?.name} 👋</Text>

      {/* ── Upcoming Games ── */}
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
            {renderGamesGrid(games)}
          </View>
        ))
      )}

      {/* ── Key Follow-ups ── */}
      <View style={styles.followUpsHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons name="chatbubbles" size={20} color={Colors.amber} />
          <Text style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>
            Key Follow-ups{followUpsScope === 'mine' && user?.homeState ? ` · ${user.homeState}` : ''}
          </Text>
        </View>
        {isAdmin && (
          <TouchableOpacity
            onPress={() => setFollowUpsScope(followUpsScope === 'mine' ? 'all' : 'mine')}
            style={styles.scopeToggle}
          >
            <Text style={styles.scopeToggleText}>
              {followUpsScope === 'mine' ? 'View all states' : 'View my state'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {followUps?.homeStateUnset && (
        <Card style={styles.warningCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="warning-outline" size={20} color={Colors.amber} />
            <Text style={styles.warningText}>Set your home state to see scoped follow-ups</Text>
          </View>
        </Card>
      )}

      {followUps && followUps.total === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Ionicons name="checkmark-circle-outline" size={36} color={Colors.green} />
            <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 8 }}>
              All caught up! No follow-ups needed.
            </Text>
          </View>
        </Card>
      ) : (
        <>
          {followUps?.items.slice(0, 4).map((item) => (
            <Card
              key={item.playerId}
              onPress={() => router.push(`/player/${item.playerId}`)}
              style={[
                styles.followUpCard,
                {
                  // Left-border accent: red = AFL interest / urgent, amber = stale contact.
                  // Single-sided border ⇒ square corners on that edge.
                  borderLeftWidth: 4,
                  borderLeftColor: item.hasAflInterest ? Colors.error : Colors.amber,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {item.hasAflInterest && (
                      <View style={styles.aflDot} />
                    )}
                    <Text style={styles.followUpPlayerName}>{item.playerName}</Text>
                    {followUpsScope === 'all' && item.state && (
                      <View style={styles.stateBadge}>
                        <Text style={styles.stateBadgeText}>{item.state}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.followUpMeta}>
                    {item.team || 'No team'} • {item.reason}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
              </View>
            </Card>
          ))}
          {followUps && followUps.total > 4 && (
            <TouchableOpacity
              onPress={() => router.push('/watch-lists')}
              style={styles.viewMoreLink}
            >
              <Text style={styles.viewMoreText}>
                + {followUps.total - 4} more · View full watch list
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
      
      <GradientButton title="+ Quick Add Report" onPress={() => router.push('/report/new')} style={{ marginBottom: 24, marginTop: 12 }} />

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  greeting: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  reportCard: { marginBottom: 12 },
  playerName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  upcomingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  weekendLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  dateGroupLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8, marginTop: 4 },
  emptyCard: { marginBottom: 20 },
  gamesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gameCard: { padding: 14 },
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

  // Follow-ups section
  followUpsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 24 },
  scopeToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.elevated },
  scopeToggleText: { fontSize: 12, color: Colors.accent, fontWeight: '700' },
  warningCard: { marginBottom: 12, padding: 12, backgroundColor: Colors.amber + '15', borderLeftWidth: 3, borderLeftColor: Colors.amber },
  warningText: { fontSize: 13, color: Colors.amber, marginLeft: 8, fontWeight: '600' },
  followUpCard: { marginBottom: 10, padding: 14 },
  followUpPlayerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  followUpMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  aflDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error },
  stateBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: Colors.primary + '20' },
  stateBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase' },
  viewMoreLink: { alignItems: 'center', paddingVertical: 12, marginBottom: 12 },
  viewMoreText: { fontSize: 13, color: Colors.accent, fontWeight: '600' },
});