import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, useWindowDimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/theme/colors';
import { DashboardData, UpcomingGame, FollowUpsResponse, PlayerToWatch } from '../../src/types';
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

/** Generate initials avatar from player name */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpsResponse | null>(null);
  const [followUpsScope, setFollowUpsScope] = useState<'mine' | 'all'>('mine');
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
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
   * Phone collapses to single column; tablet/desktop flow into 2–4 columns */
  const GRID_GAP = 12;
  const gridColumns = width < 640 ? 1 : width < 1024 ? 2 : width < 1440 ? 3 : 4;
  const contentWidth = Math.min(width - 32, 1440);
  const gridCardWidth =
    gridColumns === 1
      ? '100%'
      : Math.floor((contentWidth - GRID_GAP * (gridColumns - 1)) / gridColumns);

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
        <Text style={styles.teamName} numberOfLines={1}>{game.homeTeam}</Text>
        <Text style={styles.vsText}>VS</Text>
        <Text style={styles.teamName} numberOfLines={1}>{game.awayTeam}</Text>
      </View>
      <View style={styles.gameDetailsRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.venueText} numberOfLines={1}>{game.venue || 'TBC'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.timeText}>{game.time || 'TBC'}</Text>
        </View>
      </View>
      <View style={styles.sessionRow}>
        {game.sessionId ? (
          <View style={styles.sessionActive}>
            <Ionicons name="radio" size={14} color={Colors.green} />
            <Text style={styles.sessionActiveText}>
              {game.sessionStatus === 'ACTIVE' ? 'Live' : 'Created'} • {game.playerCount} player{game.playerCount !== 1 ? 's' : ''}
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

  /* ── KPI Card Component ── */
  const renderKPICard = (icon: string, value: number, label: string, href: string, color: string) => (
    <TouchableOpacity
      key={label}
      style={styles.kpiCard}
      onPress={() => router.push(href as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.kpiIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <View style={styles.kpiLink}>
        <Text style={[styles.kpiLinkText, { color }]}>View all</Text>
        <Ionicons name="arrow-forward" size={14} color={color} />
      </View>
    </TouchableOpacity>
  );

  /* ── Player to Watch Card ── */
  const renderPlayerCard = (player: PlayerToWatch) => {
    const initials = getInitials(player.playerName);
    return (
      <TouchableOpacity
        key={player.playerId}
        style={styles.playerCard}
        onPress={() => router.push(`/player/${player.playerId}`)}
        activeOpacity={0.8}
      >
        <View style={styles.playerPhotoContainer}>
          {player.photoUrl ? (
            <Image source={{ uri: player.photoUrl }} style={styles.playerPhoto} />
          ) : (
            <View style={styles.playerInitials}>
              <Text style={styles.playerInitialsText}>{initials}</Text>
            </View>
          )}
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerCardName} numberOfLines={1}>{player.playerName}</Text>
          <Text style={styles.playerCardTeam} numberOfLines={1}>{player.team || 'No team'}</Text>
          {player.position && (
            <Text style={styles.playerCardPosition}>{player.position}</Text>
          )}
        </View>
        <View style={styles.playerCardAction}>
          <Ionicons name="person-outline" size={16} color={Colors.accent} />
          <Text style={styles.playerCardActionText}>View Profile</Text>
        </View>
      </TouchableOpacity>
    );
  };

  /* ── Activity Stat Tile ── */
  const renderActivityTile = (icon: string, value: number, label: string, color: string) => (
    <View key={label} style={styles.activityTile}>
      <Ionicons name={icon as any} size={22} color={color} />
      <Text style={[styles.activityValue, { color }]}>{value}</Text>
      <Text style={styles.activityLabel}>{label}</Text>
    </View>
  );

  /* ── DESKTOP LAYOUT (Recent Reports on right side) ── */
  if (isDesktop) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentDesktop}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <View style={styles.mainColumn}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome back, {user?.name?.split(' ')[0] || user?.name} 👋</Text>
              <Text style={styles.subGreeting}>Here's your scouting snapshot for this week.</Text>
            </View>
          </View>

          {/* KPI Cards */}
          <View style={styles.kpiGrid}>
            {renderKPICard('eye-outline', data?.kpis?.watchListCount || 0, 'Watch List', '/watch-lists', Colors.primary)}
            {renderKPICard('calendar-outline', upcoming?.totalGames || 0, 'Games This Week', '/fixtures', Colors.accent)}
            {renderKPICard('chatbubbles-outline', data?.kpis?.followUpsDue || 0, 'Follow-ups Due', '/watch-lists', Colors.amber)}
            {renderKPICard('star-outline', data?.kpis?.strongProspects || 0, 'Strong Prospects', '/watch-lists', Colors.green)}
          </View>

          {/* Upcoming Games */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar" size={22} color={Colors.accent} />
                <Text style={styles.sectionTitle}>Upcoming Games</Text>
              </View>
              {upcoming?.weekendLabel && (
                <Text style={styles.weekendLabel}>{upcoming.weekendLabel}</Text>
              )}
            </View>

            {upcoming && upcoming.totalGames === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="football-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No games scheduled for this weekend</Text>
              </Card>
            ) : (
              Object.entries(gameGroups).map(([dateLabel, games]) => (
                <View key={dateLabel} style={{ marginBottom: 16 }}>
                  <Text style={styles.dateGroupLabel}>{dateLabel}</Text>
                  {renderGamesGrid(games)}
                </View>
              ))
            )}
          </View>

          {/* Players to Watch This Week */}
          {data?.playersToWatch && data.playersToWatch.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="star" size={22} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Players to Watch This Week</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/watch-lists')}>
                  <Text style={styles.viewAllLink}>View all →</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playersScroll}>
                {data.playersToWatch.map(renderPlayerCard)}
              </ScrollView>
            </View>
          )}

          {/* Key Follow-ups */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="chatbubbles" size={22} color={Colors.amber} />
                <Text style={styles.sectionTitle}>
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
                <Ionicons name="warning-outline" size={20} color={Colors.amber} />
                <Text style={styles.warningText}>Set your home state to see scoped follow-ups</Text>
              </Card>
            )}

            {followUps && followUps.total === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="checkmark-circle-outline" size={40} color={Colors.green} />
                <Text style={styles.emptyText}>All caught up! No follow-ups needed.</Text>
              </Card>
            ) : (
              <>
                {followUps?.items.slice(0, 5).map((item) => (
                  <Card
                    key={item.playerId}
                    onPress={() => router.push(`/player/${item.playerId}`)}
                    style={[
                      styles.followUpCard,
                      {
                        borderLeftWidth: 4,
                        borderLeftColor: item.hasAflInterest ? Colors.error : Colors.amber,
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                      },
                    ]}
                  >
                    <View style={styles.followUpContent}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.followUpHeader}>
                          {item.hasAflInterest && <View style={styles.aflDot} />}
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
                {followUps && followUps.total > 5 && (
                  <TouchableOpacity
                    onPress={() => router.push('/watch-lists')}
                    style={styles.viewMoreLink}
                  >
                    <Text style={styles.viewMoreText}>
                      + {followUps.total - 5} more · View full watch list
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Scouting Activity Snapshot */}
          {data?.activity && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="analytics" size={22} color={Colors.accent} />
                  <Text style={styles.sectionTitle}>Scouting Activity Snapshot</Text>
                </View>
              </View>
              <View style={styles.activityGrid}>
                {renderActivityTile('document-text-outline', data.activity.reportsThisMonth, 'Reports This Month', Colors.primary)}
                {renderActivityTile('eye-outline', data.activity.playersWatched, 'Players Watched', Colors.accent)}
                {renderActivityTile('business-outline', data.activity.clubsCovered, 'Clubs Covered', Colors.green)}
                {renderActivityTile('american-football-outline', data.activity.scoutingSessions, 'Scouting Sessions', Colors.amber)}
              </View>
            </View>
          )}

          <GradientButton
            title="+ Quick Add Report"
            onPress={() => router.push('/report/new')}
            style={{ marginTop: 12 }}
          />
        </View>

        {/* RIGHT SIDEBAR: Recent Reports */}
        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Recent Reports</Text>
            <TouchableOpacity onPress={() => router.push('/reports')}>
              <Text style={styles.viewAllLink}>View all →</Text>
            </TouchableOpacity>
          </View>
          {data?.recentReports && data.recentReports.length === 0 ? (
            <Card style={styles.emptyReportsCard}>
              <Ionicons name="document-text-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyReportsText}>No reports in the last 7 days</Text>
              <TouchableOpacity onPress={() => router.push('/report/new')} style={styles.emptyReportsAction}>
                <Text style={styles.emptyReportsActionText}>Create first report</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            data?.recentReports?.slice(0, 8).map((r) => (
              <Card key={r.id} onPress={() => router.push(`/report/${r.id}/edit`)} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportPlayerName} numberOfLines={1}>{r.playerName}</Text>
                  {r.overallProjection && <ProjectionBadge value={r.overallProjection} />}
                </View>
                <Text style={styles.reportMeta}>vs {r.opponent}</Text>
                <Text style={styles.reportMeta}>{new Date(r.matchDate).toLocaleDateString()}</Text>
                <Text style={styles.reportScout}>{r.scoutName}</Text>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    );
  }

  /* ── MOBILE LAYOUT (Recent Reports inline) ── */
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentMobile}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back, {user?.name?.split(' ')[0] || user?.name} 👋</Text>
        <Text style={styles.subGreeting}>Here's your scouting snapshot for this week.</Text>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiGrid}>
        {renderKPICard('eye-outline', data?.kpis?.watchListCount || 0, 'Watch List', '/watch-lists', Colors.primary)}
        {renderKPICard('calendar-outline', upcoming?.totalGames || 0, 'Games This Week', '/fixtures', Colors.accent)}
        {renderKPICard('chatbubbles-outline', data?.kpis?.followUpsDue || 0, 'Follow-ups Due', '/watch-lists', Colors.amber)}
        {renderKPICard('star-outline', data?.kpis?.strongProspects || 0, 'Strong Prospects', '/watch-lists', Colors.green)}
      </View>

      {/* Upcoming Games */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="calendar" size={22} color={Colors.accent} />
            <Text style={styles.sectionTitle}>Upcoming Games</Text>
          </View>
          {upcoming?.weekendLabel && (
            <Text style={styles.weekendLabel}>{upcoming.weekendLabel}</Text>
          )}
        </View>

        {upcoming && upcoming.totalGames === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="football-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No games scheduled for this weekend</Text>
          </Card>
        ) : (
          Object.entries(gameGroups).map(([dateLabel, games]) => (
            <View key={dateLabel} style={{ marginBottom: 16 }}>
              <Text style={styles.dateGroupLabel}>{dateLabel}</Text>
              {renderGamesGrid(games)}
            </View>
          ))
        )}
      </View>

      {/* Players to Watch This Week */}
      {data?.playersToWatch && data.playersToWatch.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="star" size={22} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Players to Watch This Week</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playersScroll}>
            {data.playersToWatch.map(renderPlayerCard)}
          </ScrollView>
        </View>
      )}

      {/* Key Follow-ups */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Ionicons name="chatbubbles" size={22} color={Colors.amber} />
            <Text style={styles.sectionTitle}>
              Key Follow-ups{followUpsScope === 'mine' && user?.homeState ? ` · ${user.homeState}` : ''}
            </Text>
          </View>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => setFollowUpsScope(followUpsScope === 'mine' ? 'all' : 'mine')}
              style={styles.scopeToggle}
            >
              <Text style={styles.scopeToggleText}>
                {followUpsScope === 'mine' ? 'View all' : 'My state'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {followUps?.homeStateUnset && (
          <Card style={styles.warningCard}>
            <Ionicons name="warning-outline" size={20} color={Colors.amber} />
            <Text style={styles.warningText}>Set your home state to see scoped follow-ups</Text>
          </Card>
        )}

        {followUps && followUps.total === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={40} color={Colors.green} />
            <Text style={styles.emptyText}>All caught up!</Text>
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
                    borderLeftWidth: 4,
                    borderLeftColor: item.hasAflInterest ? Colors.error : Colors.amber,
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                  },
                ]}
              >
                <View style={styles.followUpContent}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.followUpHeader}>
                      {item.hasAflInterest && <View style={styles.aflDot} />}
                      <Text style={styles.followUpPlayerName}>{item.playerName}</Text>
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
                  + {followUps.total - 4} more · View full list
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Recent Reports */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Reports</Text>
          <TouchableOpacity onPress={() => router.push('/reports')}>
            <Text style={styles.viewAllLink}>View all →</Text>
          </TouchableOpacity>
        </View>
        {data?.recentReports && data.recentReports.length === 0 ? (
          <Card style={styles.emptyReportsCard}>
            <Ionicons name="document-text-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyReportsText}>No reports in the last 7 days</Text>
            <TouchableOpacity onPress={() => router.push('/report/new')} style={styles.emptyReportsAction}>
              <Text style={styles.emptyReportsActionText}>Create first report</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          data?.recentReports?.slice(0, 5).map((r) => (
            <Card key={r.id} onPress={() => router.push(`/report/${r.id}/edit`)} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportPlayerName} numberOfLines={1}>{r.playerName}</Text>
                {r.overallProjection && <ProjectionBadge value={r.overallProjection} />}
              </View>
              <Text style={styles.reportMeta}>vs {r.opponent} • {new Date(r.matchDate).toLocaleDateString()}</Text>
              <Text style={styles.reportScout}>{r.scoutName}</Text>
            </Card>
          ))
        )}
      </View>

      {/* Scouting Activity Snapshot */}
      {data?.activity && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="analytics" size={22} color={Colors.accent} />
              <Text style={styles.sectionTitle}>Activity Snapshot</Text>
            </View>
          </View>
          <View style={styles.activityGrid}>
            {renderActivityTile('document-text-outline', data.activity.reportsThisMonth, 'Reports', Colors.primary)}
            {renderActivityTile('eye-outline', data.activity.playersWatched, 'Players', Colors.accent)}
            {renderActivityTile('business-outline', data.activity.clubsCovered, 'Clubs', Colors.green)}
            {renderActivityTile('american-football-outline', data.activity.scoutingSessions, 'Sessions', Colors.amber)}
          </View>
        </View>
      )}

      <GradientButton
        title="+ Quick Add Report"
        onPress={() => router.push('/report/new')}
        style={{ marginTop: 12, marginBottom: 32 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentDesktop: {
    flexDirection: 'row',
    padding: 20,
    maxWidth: 1600,
    width: '90%',
    marginHorizontal: 'auto' as any,
    gap: 24,
  },
  contentMobile: {
    padding: 16,
    paddingBottom: 32,
  },
  mainColumn: { flex: 1, minWidth: 0 },
  sidebar: {
    width: 340,
    flexShrink: 0,
  },

  // Header
  header: { marginBottom: 24 },
  greeting: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  subGreeting: { fontSize: 15, color: Colors.textSecondary },

  // KPI Cards
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  kpiCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 18,
    flex: 1,
    minWidth: 140,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kpiIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kpiValue: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  kpiLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kpiLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Section
  section: { marginBottom: 32 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 10,
  },
  weekendLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  viewAllLink: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '600',
  },

  // Upcoming Games
  dateGroupLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  gamesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gameCard: { padding: 16 },
  gameTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  compBadge: {
    backgroundColor: Colors.primary + '22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  roundText: { fontSize: 12, color: Colors.textSecondary, marginLeft: 10 },
  teamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  teamName: { fontSize: 16, fontWeight: '700', color: Colors.text, flex: 1 },
  vsText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginHorizontal: 10,
    fontWeight: '700',
  },
  gameDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  venueText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 6,
    flex: 1,
    marginRight: 8,
  },
  timeText: { fontSize: 12, color: Colors.textSecondary, marginLeft: 6, fontWeight: '600' },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  sessionActive: { flexDirection: 'row', alignItems: 'center' },
  sessionActiveText: { fontSize: 12, color: Colors.green, marginLeft: 6, fontWeight: '600' },
  sessionCreate: { flexDirection: 'row', alignItems: 'center' },
  sessionCreateText: { fontSize: 12, color: Colors.accent, marginLeft: 6, fontWeight: '600' },

  // Players to Watch
  playersScroll: { gap: 12, paddingRight: 16 },
  playerCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    width: 180,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerPhotoContainer: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: 12,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.elevated,
  },
  playerPhoto: { width: '100%', height: '100%' },
  playerInitials: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '22',
  },
  playerInitialsText: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
  },
  playerInfo: { marginBottom: 12 },
  playerCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 3,
  },
  playerCardTeam: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  playerCardPosition: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  playerCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  playerCardActionText: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
  },

  // Follow-ups
  scopeToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
  },
  scopeToggleText: { fontSize: 12, color: Colors.accent, fontWeight: '700' },
  warningCard: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: Colors.amber + '15',
    borderLeftWidth: 3,
    borderLeftColor: Colors.amber,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  warningText: { fontSize: 13, color: Colors.amber, fontWeight: '600' },
  followUpCard: { marginBottom: 10, padding: 14 },
  followUpContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  followUpHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  followUpPlayerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  followUpMeta: { fontSize: 13, color: Colors.textSecondary },
  aflDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error },
  stateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: Colors.primary + '20',
  },
  stateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  viewMoreLink: { alignItems: 'center', paddingVertical: 12 },
  viewMoreText: { fontSize: 13, color: Colors.accent, fontWeight: '600' },

  // Recent Reports Sidebar
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sidebarTitle: { fontSize: 19, fontWeight: '700', color: Colors.text },
  reportCard: { marginBottom: 10, padding: 14 },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reportPlayerName: { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1 },
  reportMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  reportScout: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  // Activity Snapshot
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activityTile: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 16,
    flex: 1,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityValue: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  activityLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Empty states
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyReportsCard: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyReportsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyReportsAction: {
    marginTop: 8,
  },
  emptyReportsActionText: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '600',
  },
});
