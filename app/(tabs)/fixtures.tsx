import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, DateData } from 'react-native-calendars';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import Card from '../../src/components/Card';
import DatePicker from '../../src/components/DatePicker';
import EmptyState from '../../src/components/EmptyState';
import { Colors } from '../../src/theme/colors';
import { showAlert } from '../../src/utils/alert';
import { Fixture } from '../../src/types';
import { useAuth } from '../../src/context/AuthContext';
import { createFixture, listFixtures, getFixtureDates, uploadFixturesExcel } from '../../src/api/fixtures';

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

type FixtureStatus = Fixture['status'];

interface FixtureFormState {
  competition: string;
  round: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  status: FixtureStatus;
}

const STATUS_OPTIONS: FixtureStatus[] = ['SCHEDULED', 'COMPLETED', 'POSTPONED', 'CANCELLED'];

const EMPTY_FIXTURE_FORM: FixtureFormState = {
  competition: 'WAFL Colts',
  round: '',
  date: '',
  time: '',
  homeTeam: '',
  awayTeam: '',
  venue: '',
  status: 'SCHEDULED',
};

const EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

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
  const { user } = useAuth();
  const normalizedRole = (user?.role || '').toString().trim().toUpperCase();
  const isAdmin = normalizedRole === 'ADMIN';

  useEffect(() => {
    console.log('[Fixtures] Auth user debug:', user);
    console.log('[Fixtures] Admin visibility debug:', {
      rawRole: user?.role,
      normalizedRole,
      isAdmin,
    });
  }, [user, normalizedRole, isAdmin]);

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [competition, setCompetition] = useState<CompetitionFilter>('WAFL Colts');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [fixtureDates, setFixtureDates] = useState<string[]>([]);
  const [datesLoading, setDatesLoading] = useState(false);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [fixtureForm, setFixtureForm] = useState<FixtureFormState>(EMPTY_FIXTURE_FORM);
  const [savingFixture, setSavingFixture] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const today = useMemo(() => todayString(), []);

  const resetFixtureForm = () => {
    setFixtureForm(EMPTY_FIXTURE_FORM);
  };

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

  const refreshFixturesAndDates = async () => {
    await loadFixtures();
    const comp = competition === 'All' ? undefined : competition;
    const dates = await getFixtureDates(comp);
    setFixtureDates(dates ?? []);
  };

  const openAddFixtureModal = () => {
    resetFixtureForm();
    setAddModalVisible(true);
  };

  const closeAddFixtureModal = () => {
    setAddModalVisible(false);
    resetFixtureForm();
  };

  const validateFixtureForm = () => {
    if (!fixtureForm.competition.trim()) return 'Competition is required.';
    if (!fixtureForm.round.trim()) return 'Round is required.';
    if (!fixtureForm.date.trim()) return 'Date is required.';
    if (!fixtureForm.homeTeam.trim()) return 'Home team is required.';
    if (!fixtureForm.awayTeam.trim()) return 'Away team is required.';
    return null;
  };

  const handleCreateFixture = async () => {
    const validationError = validateFixtureForm();
    if (validationError) {
      showAlert('Missing details', validationError);
      return;
    }

    try {
      setSavingFixture(true);
      await createFixture({
        competition: fixtureForm.competition.trim(),
        round: fixtureForm.round.trim(),
        date: fixtureForm.date,
        time: fixtureForm.time.trim() || undefined,
        homeTeam: fixtureForm.homeTeam.trim(),
        awayTeam: fixtureForm.awayTeam.trim(),
        venue: fixtureForm.venue.trim() || undefined,
        status: fixtureForm.status,
      });

      closeAddFixtureModal();
      await refreshFixturesAndDates();
      showAlert('Success', 'Fixture added successfully.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to add fixture';
      showAlert('Error', msg);
    } finally {
      setSavingFixture(false);
    }
  };

  const handleUploadFixtures = async () => {
    try {
      setUploadingFile(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: EXCEL_MIME_TYPES,
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const selectedFile = result.assets?.[0];
      if (!selectedFile?.uri) {
        throw new Error('Unable to read selected file.');
      }

      const fileName = selectedFile.name || 'fixtures.xlsx';
      if (!/\.xlsx?$/.test(fileName.toLowerCase())) {
        throw new Error('Please choose a valid .xlsx or .xls file.');
      }

      // Parse workbook client-side for basic validation before upload
      const fileResponse = await fetch(selectedFile.uri);
      const arrayBuffer = await fileResponse.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames?.[0];
      if (!firstSheetName) {
        throw new Error('No worksheet found in the selected file.');
      }
      const firstSheet = workbook.Sheets[firstSheetName];
      const parsedRows = XLSX.utils.sheet_to_json(firstSheet, { defval: null });
      if (!parsedRows.length) {
        throw new Error('The selected Excel file has no data rows.');
      }

      const mimeType = selectedFile.mimeType || EXCEL_MIME_TYPES[0];
      let uploadFile: any;

      if (Platform.OS === 'web' && typeof File !== 'undefined') {
        const blob = new Blob([arrayBuffer], { type: mimeType });
        uploadFile = new File([blob], fileName, { type: mimeType });
      } else {
        uploadFile = {
          uri: selectedFile.uri,
          name: fileName,
          type: mimeType,
        };
      }

      const uploadResult = await uploadFixturesExcel(uploadFile);
      await refreshFixturesAndDates();

      const warningText = uploadResult.errors?.length
        ? `\n\nWarnings:\n${uploadResult.errors.slice(0, 5).join('\n')}`
        : '';

      showAlert(
        'Upload complete',
        `Imported ${uploadResult.fixturesImported} of ${uploadResult.totalRows} row(s).${warningText}`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Fixture upload failed';
      showAlert('Upload failed', msg);
    } finally {
      setUploadingFile(false);
    }
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
      <View style={styles.debugPanel}>
        <Text style={styles.debugPanelTitle}>DEBUG MODE: TEST - ADMIN BUTTONS (VISIBLE FOR ALL USERS)</Text>
        <Text style={styles.debugPanelText}>User: {user?.email || 'unknown'}</Text>
        <Text style={styles.debugPanelText}>Role: {user?.role || 'unknown'}</Text>
        <Text style={styles.debugPanelText}>IsAdmin: {String(isAdmin)}</Text>
      </View>

      <View style={styles.topActionsWrap}>
        <Text style={styles.topActionsLabel}>TEST - ADMIN BUTTONS</Text>
        <View style={styles.topActionsRow}>
          <TouchableOpacity
            style={[styles.topActionButton, styles.addFixtureButton]}
            onPress={openAddFixtureModal}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Add fixture"
          >
            <Ionicons name="add-circle-outline" size={24} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.topActionButtonText}>TEST - + ADD FIXTURE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.topActionButton, styles.uploadButton]}
            onPress={handleUploadFixtures}
            activeOpacity={0.85}
            disabled={uploadingFile}
            accessibilityRole="button"
            accessibilityLabel="Upload fixtures file"
          >
            {uploadingFile ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={24} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.topActionButtonText}>TEST - UPLOAD FIXTURES</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filtersWrap}>
        <Text style={styles.heading}>🔴🔴🔴 TEST FIXTURES 🔴🔴🔴</Text>
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
        <View style={styles.centered}>
          <EmptyState icon="calendar-outline" message={emptyMessage} />
        </View>
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

      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeAddFixtureModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Fixture</Text>
              <TouchableOpacity onPress={closeAddFixtureModal}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Competition *</Text>
                <TextInput
                  value={fixtureForm.competition}
                  onChangeText={(value) => setFixtureForm((prev) => ({ ...prev, competition: value }))}
                  placeholder="WAFL Colts"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Round *</Text>
                <TextInput
                  value={fixtureForm.round}
                  onChangeText={(value) => setFixtureForm((prev) => ({ ...prev, round: value }))}
                  placeholder="Round 1"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.formInput}
                />
              </View>

              <DatePicker
                label="Date * (DD/MM/YYYY)"
                value={fixtureForm.date}
                onChange={(value) => setFixtureForm((prev) => ({ ...prev, date: value }))}
              />

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Time</Text>
                <TextInput
                  value={fixtureForm.time}
                  onChangeText={(value) => setFixtureForm((prev) => ({ ...prev, time: value }))}
                  placeholder="14:30"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Home Team *</Text>
                <TextInput
                  value={fixtureForm.homeTeam}
                  onChangeText={(value) => setFixtureForm((prev) => ({ ...prev, homeTeam: value }))}
                  placeholder="Home team"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Away Team *</Text>
                <TextInput
                  value={fixtureForm.awayTeam}
                  onChangeText={(value) => setFixtureForm((prev) => ({ ...prev, awayTeam: value }))}
                  placeholder="Away team"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Venue</Text>
                <TextInput
                  value={fixtureForm.venue}
                  onChangeText={(value) => setFixtureForm((prev) => ({ ...prev, venue: value }))}
                  placeholder="Venue"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Status</Text>
                <View style={styles.statusSelectorRow}>
                  {STATUS_OPTIONS.map((statusOption) => {
                    const active = fixtureForm.status === statusOption;
                    return (
                      <TouchableOpacity
                        key={statusOption}
                        onPress={() => setFixtureForm((prev) => ({ ...prev, status: statusOption }))}
                        style={[
                          styles.statusSelectorChip,
                          active && {
                            backgroundColor: `${STATUS_COLORS[statusOption]}22`,
                            borderColor: STATUS_COLORS[statusOption],
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusSelectorText,
                            active && { color: STATUS_COLORS[statusOption] },
                          ]}
                        >
                          {STATUS_LABELS[statusOption]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeAddFixtureModal}
                disabled={savingFixture}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, savingFixture && styles.submitButtonDisabled]}
                onPress={handleCreateFixture}
                disabled={savingFixture}
              >
                {savingFixture ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Save Fixture</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  debugPanel: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#2A0000',
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  debugPanelTitle: {
    color: '#FFDADA',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 6,
  },
  debugPanelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  topActionsWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderWidth: 2,
    borderRadius: 12,
    borderColor: '#FF0000',
    backgroundColor: '#3A0000',
  },
  topActionsLabel: {
    color: '#FF5A5A',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  filtersWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
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
  topActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  topActionButton: {
    flex: 1,
    minHeight: 74,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
    paddingHorizontal: 10,
  },
  topActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
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
  uploadButton: {
    backgroundColor: '#FF4D4D',
  },
  addFixtureButton: {
    backgroundColor: '#E00000',
  },
  buttonIcon: {
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '90%',
    backgroundColor: Colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalBody: {
    padding: 16,
    paddingBottom: 12,
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: Colors.elevated,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: Colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statusSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusSelectorChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusSelectorText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
