import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, DateData } from 'react-native-calendars';
import Card from '../../src/components/Card';
import EmptyState from '../../src/components/EmptyState';
import { Colors } from '../../src/theme/colors';
import { showAlert } from '../../src/utils/alert';
import { Fixture } from '../../src/types';
import { listFixtures, getFixtureDates } from '../../src/api/fixtures';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager?.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

const todayString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

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
  const dateA = new Date(a?.date ?? '').getTime();
  const dateB = new Date(b?.date ?? '').getTime();
  if (dateA !== dateB) return dateA - dateB;
  return (a?.time || '').localeCompare(b?.time || '');
};

export default function FixturesScreen() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [competition, setCompetition] = useState<CompetitionFilter>('WAFL Colts');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [fixtureDates, setFixtureDates] = useState<string[]>([]);
  const [datesLoading, setDatesLoading] = useState(false);

  const today = useMemo(() => todayString(), []);

  // Fetch fixture dates for calendar dot markers
  useEffect(() => {
    let cancelled = false;
    const loadDates = async () => {
      setDatesLoading(true);
      const comp = competition === 'All' ? undefined : competition;
      const dates = await getFixtureDates(comp);
      console.log('[Fixtures] Date markers response:', {
        competition: comp,
        datesCount: dates?.length ?? 0,
      });
      if (!cancelled) {
        setFixtureDates(dates ?? []);
        setDatesLoading(false);
      }
    };
    loadDates();
    return () => { cancelled = true; };
  }, [competition]);

  // Load fixtures
  const loadFixtures = useCallback(async () => {
    try {
      const comp = competition === 'All' ? undefined : competition;
      const params = {
        competition: comp,
        date: selectedDate ?? undefined,
        limit: 200,
      };
      console.log('[Fixtures] Request params:', params);
      const result = await listFixtures(params);
      console.log('[Fixtures] API response:', {
        total: result?.total,
        count: result?.fixtures?.length ?? 0,
        firstFixture: result?.fixtures?.[0],
      });
      const sorted = [...(result?.fixtures ?? [])].sort(fixtureSort);
      setFixtures(sorted);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load fixtures';
      console.error('[Fixtures] Load failed:', e);
      showAlert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [competition, selectedDate]);

  useEffect(() => {
    setLoading(true);
    loadFixtures();
  }, [loadFixtures]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFixtures();
    setRefreshing(false);
  };

  // Build marked dates for calendar
  const markedDates = useMemo(() => {
    const marks: Record<string, {
      marked?: boolean;
      dotColor?: string;
      selected?: boolean;
      selectedColor?: string;
      selectedTextColor?: string;
    }> = {};

    // Mark all dates that have fixtures
    (fixtureDates ?? []).forEach((d) => {
      marks[d] = {
        marked: true,
        dotColor: Colors.accent,
      };
    });

    // Highlight selected date
    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] ?? {}),
        selected: true,
        selectedColor: Colors.primary,
        selectedTextColor: '#ffffff',
      };
    }

    return marks;
  }, [fixtureDates, selectedDate]);

  const toggleCalendar = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCalendarExpanded((prev) => !prev);
  };

  const handleDayPress = (day: DateData) => {
    const dateStr = day?.dateString;
    if (!dateStr) return;
    setSelectedDate(dateStr);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCalendarExpanded(false);
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
    setCalendarExpanded(false);
  };

  const groupedByRound = useMemo(() => {
    const grouped = new Map<string, Fixture[]>();
    (fixtures ?? []).forEach((fixture) => {
      const key = fixture?.round || 'Unassigned Round';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(fixture);
    });
    return Array.from(grouped.entries()).map(([round, rows]) => ({ round, rows }));
  }, [fixtures]);

  const fixtureCountText = selectedDate
    ? `${fixtures?.length ?? 0} fixture${(fixtures?.length ?? 0) === 1 ? '' : 's'} on ${formatDate(selectedDate)}`
    : `${fixtures?.length ?? 0} fixture${(fixtures?.length ?? 0) === 1 ? '' : 's'} found`;

  const calendarToggleLabel = selectedDate
    ? `Showing: ${formatDate(selectedDate)}`
    : 'Select a date to filter';

  const emptyMessage = selectedDate
    ? `No fixtures on ${formatDate(selectedDate)}. Try a different date.`
    : 'No fixtures found for this filter.';

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
                onPress={() => {
                  setCompetition(option);
                  setSelectedDate(null);
                }}
                accessibilityLabel={`Filter by ${option}`}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Calendar Section */}
        <View style={styles.calendarSection}>
          <TouchableOpacity
            style={styles.calendarToggle}
            onPress={toggleCalendar}
            accessibilityLabel="Toggle calendar date picker"
            accessibilityRole="button"
          >
            <Ionicons
              name={calendarExpanded ? 'calendar' : 'calendar-outline'}
              size={20}
              color={Colors.accent}
            />
            <Text style={styles.calendarToggleText}>{calendarToggleLabel}</Text>
            {datesLoading ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Ionicons
                name={calendarExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.textMuted}
              />
            )}
          </TouchableOpacity>

          {calendarExpanded && (
            <View style={styles.calendarWrapper}>
              <Calendar
                current={selectedDate || today}
                onDayPress={handleDayPress}
                markedDates={markedDates}
                enableSwipeMonths
                theme={{
                  backgroundColor: Colors.elevated,
                  calendarBackground: Colors.elevated,
                  textSectionTitleColor: Colors.textSecondary,
                  selectedDayBackgroundColor: Colors.primary,
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: Colors.accent,
                  dayTextColor: Colors.text,
                  textDisabledColor: Colors.textMuted,
                  dotColor: Colors.accent,
                  selectedDotColor: '#ffffff',
                  arrowColor: Colors.accent,
                  monthTextColor: Colors.text,
                  textMonthFontWeight: 'bold',
                  textDayFontSize: 14,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 12,
                }}
              />
            </View>
          )}

          {selectedDate ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearDateFilter}
              accessibilityLabel="Clear date filter"
              accessibilityRole="button"
            >
              <Ionicons name="close-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.clearButtonText}>Clear Date Filter</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.totalText}>{fixtureCountText}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (fixtures?.length ?? 0) === 0 ? (
        <EmptyState icon="calendar-outline" message={emptyMessage} />
      ) : (
        <FlatList
          data={groupedByRound ?? []}
          keyExtractor={(item) => item?.round ?? 'unknown'}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          renderItem={({ item }) => (
            <View style={styles.roundSection}>
              <Text style={styles.roundTitle}>{item?.round ?? ''}</Text>
              {(item?.rows ?? []).map((fixture) => (
                <Card key={fixture?.id ?? Math.random().toString()} style={styles.fixtureCard}>
                  <View style={styles.rowTop}>
                    <Text style={styles.teamText}>
                      {fixture?.homeTeam ?? 'TBC'} <Text style={styles.vs}>vs</Text> {fixture?.awayTeam ?? 'TBC'}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: `${STATUS_COLORS[fixture?.status ?? 'SCHEDULED']}33` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: STATUS_COLORS[fixture?.status ?? 'SCHEDULED'] },
                        ]}
                      >
                        {STATUS_LABELS[fixture?.status ?? 'SCHEDULED']}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{formatDate(fixture?.date ?? '')}</Text>
                    {fixture?.time ? <Text style={styles.metaText}>• {fixture.time}</Text> : null}
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{fixture?.venue || 'Venue TBC'}</Text>
                  </View>

                  {fixture?.status === 'COMPLETED' && (fixture?.homeScore || fixture?.awayScore) ? (
                    <Text style={styles.scoreText}>
                      Score: {fixture?.homeTeam ?? ''} {fixture?.homeScore || '-'} - {fixture?.awayTeam ?? ''}{' '}
                      {fixture?.awayScore || '-'}
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
  // Calendar styles
  calendarSection: {
    marginTop: 12,
    marginBottom: 4,
  },
  calendarToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calendarToggleText: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  calendarWrapper: {
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.error,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
