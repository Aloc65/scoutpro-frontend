import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../src/components/Card';
import EmptyState from '../../src/components/EmptyState';
import { api } from '../../src/api/client';
import { Colors } from '../../src/theme/colors';
import { showAlert } from '../../src/utils/alert';
import { Fixture, FixtureListResponse } from '../../src/types';

const STATUS_LABELS: Record<Fixture['status'], string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  POSTPONED: 'Postponed',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<Fixture['status'], string> = {
  SCHEDULED: Colors.accent,
  COMPLETED: Colors.green,
  POSTPONED: Colors.amber,
  CANCELLED: Colors.error,
};

const COMPETITION_OPTIONS = ['All', 'WAFL Colts'] as const;

type CompetitionFilter = (typeof COMPETITION_OPTIONS)[number];

const formatDate = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const fixtureSort = (a: Fixture, b: Fixture) => {
  const dateA = new Date(a.date).getTime();
  const dateB = new Date(b.date).getTime();
  if (dateA !== dateB) return dateA - dateB;
  return (a.time || '').localeCompare(b.time || '');
};

export default function FixturesScreen() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [competition, setCompetition] = useState<CompetitionFilter>('WAFL Colts');

  const loadFixtures = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (competition !== 'All') params.set('competition', competition);
      const query = params.toString();
      const res = await api.get<FixtureListResponse>(`/api/fixtures${query ? `?${query}` : ''}`);
      const sorted = [...(res.fixtures || [])].sort(fixtureSort);
      setFixtures(sorted);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to load fixtures');
    } finally {
      setLoading(false);
    }
  }, [competition]);

  useEffect(() => {
    loadFixtures();
  }, [loadFixtures]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFixtures();
    setRefreshing(false);
  };

  const groupedByRound = useMemo(() => {
    const grouped = new Map<string, Fixture[]>();
    fixtures.forEach((fixture) => {
      const key = fixture.round || 'Unassigned Round';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(fixture);
    });

    return Array.from(grouped.entries()).map(([round, rows]) => ({ round, rows }));
  }, [fixtures]);

  return (
    <View style={styles.container}>
      <View style={styles.filtersWrap}>
        <Text style={styles.heading}>Fixtures</Text>
        <Text style={styles.subheading}>WAFL Colts fixture list and match schedule</Text>

        <View style={styles.filterRow}>
          {COMPETITION_OPTIONS.map((option) => {
            const active = competition === option;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setCompetition(option)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.totalText}>{fixtures.length} fixture{fixtures.length === 1 ? '' : 's'} found</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : fixtures.length === 0 ? (
        <EmptyState icon="calendar-outline" message="No fixtures found for this filter." />
      ) : (
        <FlatList
          data={groupedByRound}
          keyExtractor={(item) => item.round}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          renderItem={({ item }) => (
            <View style={styles.roundSection}>
              <Text style={styles.roundTitle}>{item.round}</Text>
              {item.rows.map((fixture) => (
                <Card key={fixture.id} style={styles.fixtureCard}>
                  <View style={styles.rowTop}>
                    <Text style={styles.teamText}>
                      {fixture.homeTeam} <Text style={styles.vs}>vs</Text> {fixture.awayTeam}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[fixture.status]}33` }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[fixture.status] }]}>
                        {STATUS_LABELS[fixture.status]}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{formatDate(fixture.date)}</Text>
                    {fixture.time ? <Text style={styles.metaText}>• {fixture.time}</Text> : null}
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{fixture.venue || 'Venue TBC'}</Text>
                  </View>

                  {fixture.status === 'COMPLETED' && (fixture.homeScore || fixture.awayScore) ? (
                    <Text style={styles.scoreText}>
                      Score: {fixture.homeTeam} {fixture.homeScore || '-'} - {fixture.awayTeam} {fixture.awayScore || '-'}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  filtersWrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  heading: { color: Colors.text, fontSize: 24, fontWeight: '800' },
  subheading: { color: Colors.textSecondary, marginTop: 4, marginBottom: 10, fontSize: 13 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 12 },
  filterChipTextActive: { color: '#fff' },
  totalText: { color: Colors.textMuted, fontSize: 12, marginTop: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  roundSection: { marginBottom: 16 },
  roundTitle: { color: Colors.accent, fontWeight: '800', fontSize: 14, marginBottom: 8, textTransform: 'uppercase' },
  fixtureCard: { marginBottom: 10 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  teamText: { color: Colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  vs: { color: Colors.textSecondary, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  metaText: { color: Colors.textSecondary, fontSize: 13 },
  scoreText: { color: Colors.text, marginTop: 10, fontSize: 13, fontWeight: '600' },
});
