import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api } from '../../src/api/client';
import { Colors, ratingColor } from '../../src/theme/colors';
import { Player, COMPETITIONS, POSITIONS, PROJECTIONS, GAME_STAT_KEYS } from '../../src/types';
import Input from '../../src/components/Input';
import GradientButton from '../../src/components/GradientButton';
import Card from '../../src/components/Card';

import { showAlert } from '../../src/utils/alert';
const FUNDAMENTALS_KEYS = [
  ['kicking', 'Kicking'], ['handball', 'Handball'], ['marking', 'Marking'],
  ['contestWork', 'Contested Work'], ['speed', 'Speed'],
] as const;

const TRAITS_KEYS = [
  ['workRate', 'Work Rate'], ['decisionMaking', 'Decision Making'], ['composure', 'Composure'],
  ['flexibility', 'Flexibility'], ['defensiveEffort', 'Defensive Effort'],
  ['gameAwareness', 'Game Awareness'],
] as const;

const RATING_KEYS = [...FUNDAMENTALS_KEYS, ...TRAITS_KEYS] as const;

const RATING_OPTIONS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

function RatingDropdown({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const color = ratingColor(value);
  return (
    <View style={rStyles.container}>
      <TouchableOpacity style={rStyles.dropdown} onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <Text style={rStyles.label}>{label}</Text>
        <View style={rStyles.valueContainer}>
          <Text style={[rStyles.value, { color }]}>{value.toFixed(1)}</Text>
          <Text style={rStyles.arrow}>{open ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>
      {open && (
        <View style={rStyles.optionsList}>
          {RATING_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[rStyles.option, opt === value && { backgroundColor: color }]}
              onPress={() => { onChange(opt); setOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[rStyles.optionText, opt === value && { color: '#fff', fontWeight: '700' }]}>{opt.toFixed(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
const rStyles = StyleSheet.create({
  container: { marginBottom: 12 },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.elevated, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  label: { color: Colors.textSecondary, fontSize: 14 },
  valueContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontWeight: '700', fontSize: 16 },
  arrow: { color: Colors.textMuted, fontSize: 10 },
  optionsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, paddingHorizontal: 4 },
  option: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border, minWidth: 52, alignItems: 'center' },
  optionText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
});

export default function NewReportScreen() {
  const { playerId } = useLocalSearchParams<{ playerId?: string }>();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(playerId || '');
  // Match date as DD/MM/YYYY text input
  const today = new Date();
  const todayDDMMYYYY = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const [matchDate, setMatchDate] = useState(todayDDMMYYYY);
  const [matchDateError, setMatchDateError] = useState<string | null>(null);
  const [opponent, setOpponent] = useState('');
  const [venue, setVenue] = useState('');
  const [competition, setCompetition] = useState('');

  const [positionsPlayed, setPositionsPlayed] = useState<string[]>([]);
  const [primaryPosition, setPrimaryPosition] = useState('');
  const [summary, setSummary] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [developmentAreas, setDevelopmentAreas] = useState('');
  const [overallProjection, setOverallProjection] = useState('');
  const [ratings, setRatings] = useState<Record<string, number>>({
    kicking: 3, handball: 3, marking: 3, workRate: 3, decisionMaking: 3,
    composure: 3, speed: 3, flexibility: 3, defensiveEffort: 3, contestWork: 3, gameAwareness: 3,
  });
  const [gameStats, setGameStats] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [fetchingStats, setFetchingStats] = useState(false);
  const [fetchMessage, setFetchMessage] = useState('');

  const validateMatchDate = (val: string): string | null => {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = regex.exec(val);
    if (!match) return 'Use DD/MM/YYYY format';
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (month < 1 || month > 12) return 'Month must be 01-12';
    if (day < 1 || day > 31) return 'Day must be 01-31';
    if (year < 2020 || year > 2030) return 'Year must be 2020-2030';
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return 'Invalid date';
    return null;
  };

  const parseMatchDateToISO = (val: string): string => {
    const [dd, mm, yyyy] = val.split('/');
    return `${yyyy}-${mm}-${dd}`;
  };

  const fetchStatsFromWeb = async () => {
    const selectedPlayer = players.find((p) => p.id === selectedPlayerId);
    if (!selectedPlayer) {
      showAlert('Missing Info', 'Please select a player first');
      return;
    }
    if (!opponent) {
      showAlert('Missing Info', 'Please enter the opponent');
      return;
    }
    if (!matchDate) {
      showAlert('Missing Info', 'Please enter the match date');
      return;
    }
    try {
      setFetchingStats(true);
      setFetchMessage('');
      const matchDateISO = validateMatchDate(matchDate) ? matchDate : parseMatchDateToISO(matchDate);
      const result = await api.post<any>('/api/stats-fetcher/fetch', {
        playerName: selectedPlayer.fullName,
        team: selectedPlayer.team || undefined,
        opponent,
        matchDate: matchDateISO,
      });
      if (result.error) {
        setFetchMessage(result.error);
        showAlert('Stats Not Found', result.error);
      } else if (result.stats) {
        const gs: Record<string, string> = {};
        GAME_STAT_KEYS.forEach(([key]) => {
          const val = result.stats[key];
          gs[key] = val != null ? String(val) : '';
        });
        setGameStats(gs);
        const note = result.matchInfo?.note;
        const info = result.matchInfo?.versus
          ? `Stats loaded: ${result.matchInfo.versus} (${result.matchInfo.round || ''} ${result.matchInfo.season || ''})`
          : 'Stats loaded successfully';
        let msg = note || info;
        // If DOB was returned from WAFL, update the player
        if (result.dateOfBirth && selectedPlayerId) {
          try {
            await api.patch(`/api/players/${selectedPlayerId}`, { dateOfBirth: result.dateOfBirth });
            msg += ' • DOB updated';
          } catch {}
        }
        setFetchMessage(msg);
      }
    } catch (e: any) {
      setFetchMessage('Failed to fetch stats');
      showAlert('Error', e.message || 'Failed to fetch stats from web');
    } finally {
      setFetchingStats(false);
    }
  };

  useEffect(() => {
    api.get<{ items: Player[] }>('/api/players?limit=200').then((d) => setPlayers(d.items)).catch(() => {});
  }, []);

  const togglePos = (p: string) => {
    if (positionsPlayed.includes(p)) {
      setPositionsPlayed(positionsPlayed.filter((x) => x !== p));
      if (primaryPosition === p) setPrimaryPosition('');
    } else {
      setPositionsPlayed([...positionsPlayed, p]);
    }
  };

  const save = async () => {
    if (!selectedPlayerId || !matchDate || !opponent || !primaryPosition || !summary) {
      showAlert('Validation', 'Please fill in all required fields (Player, Date, Opponent, Primary Position, Summary)');
      return;
    }
    const dateErr = validateMatchDate(matchDate);
    if (dateErr) {
      setMatchDateError(dateErr);
      showAlert('Validation', `Match Date: ${dateErr}`);
      return;
    }
    try {
      setSaving(true);
      const statsPayload: any = {};
      GAME_STAT_KEYS.forEach(([key]) => {
        const v = gameStats[key];
        if (v !== undefined && v !== '') statsPayload[key] = parseInt(v, 10);
      });
      const matchDateISO = parseMatchDateToISO(matchDate);
      await api.post('/api/reports', {
        playerId: selectedPlayerId,
        matchDate: new Date(matchDateISO).toISOString(),
        opponent, venue: venue || undefined, competition: competition || undefined,
        positionsPlayed, primaryPosition, summary,
        strengths: strengths || undefined, weaknesses: weaknesses || undefined,
        developmentAreas: developmentAreas || undefined,
        overallProjection: overallProjection || undefined,
        ...statsPayload,
        ratings,
      });
      showAlert('Success', 'Report created!', () => router.back());
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const filteredPlayers = playerSearch
    ? players.filter((p) => p.fullName.toLowerCase().includes(playerSearch.toLowerCase()))
    : players;

  return (
    <>
      <Stack.Screen options={{ title: 'New Report', headerStyle: { backgroundColor: Colors.card }, headerTintColor: Colors.text }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          {/* SECTION: Match Info */}
          <Text style={styles.section}>Match Info</Text>
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>Player *</Text>
            <Input label="Search player..." value={playerSearch} onChangeText={setPlayerSearch} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {filteredPlayers.slice(0, 20).map((p) => (
                <TouchableOpacity key={p.id} onPress={() => setSelectedPlayerId(p.id)}
                  style={[styles.chip, selectedPlayerId === p.id && styles.chipActive]}>
                  <Text style={[styles.chipText, selectedPlayerId === p.id && { color: '#fff' }]}>{p.fullName}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.fieldLabel}>Match Date (DD/MM/YYYY) *</Text>
            <TextInput
              style={[styles.matchDateInput, matchDateError ? styles.matchDateInputError : null]}
              value={matchDate}
              onChangeText={(val) => { setMatchDate(val); setMatchDateError(null); }}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              maxLength={10}
            />
            {matchDateError && <Text style={styles.matchDateErrorText}>{matchDateError}</Text>}
            <Input label="Opponent *" value={opponent} onChangeText={setOpponent} />
            <Input label="Venue" value={venue} onChangeText={setVenue} />
            <Text style={styles.fieldLabel}>Competition</Text>
            <View style={styles.chipRow}>
              {COMPETITIONS.map((c) => (
                <TouchableOpacity key={c} onPress={() => setCompetition(competition === c ? '' : c)}
                  style={[styles.chip, competition === c && styles.chipActive]}>
                  <Text style={[styles.chipText, competition === c && { color: '#fff' }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* SECTION: Positions */}
          <Text style={styles.section}>Positions</Text>
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>Positions Played (tap to select)</Text>
            <View style={styles.chipRow}>
              {POSITIONS.map((p) => (
                <TouchableOpacity key={p} onPress={() => togglePos(p)}
                  style={[styles.chip, positionsPlayed.includes(p) && styles.chipActive]}>
                  <Text style={[styles.chipText, positionsPlayed.includes(p) && { color: '#fff' }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Primary Position *</Text>
            <View style={styles.chipRow}>
              {positionsPlayed.map((p) => (
                <TouchableOpacity key={p} onPress={() => setPrimaryPosition(p)}
                  style={[styles.chip, primaryPosition === p && styles.chipActive]}>
                  <Text style={[styles.chipText, primaryPosition === p && { color: '#fff' }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* SECTION: Ratings */}
          <Text style={styles.section}>Ratings</Text>
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.ratingGroupTitle}>FUNDAMENTALS</Text>
            {FUNDAMENTALS_KEYS.map(([key, label]) => (
              <RatingDropdown key={key} label={label} value={ratings[key]} onChange={(v) => setRatings({ ...ratings, [key]: v })} />
            ))}
            <View style={styles.ratingDivider} />
            <Text style={styles.ratingGroupTitle}>TRAITS</Text>
            {TRAITS_KEYS.map(([key, label]) => (
              <RatingDropdown key={key} label={label} value={ratings[key]} onChange={(v) => setRatings({ ...ratings, [key]: v })} />
            ))}
          </Card>

          {/* SECTION: Game Stats */}
          <Text style={styles.section}>Game Stats</Text>
          <TouchableOpacity
            style={[styles.fetchBtn, fetchingStats && { opacity: 0.6 }]}
            onPress={fetchStatsFromWeb}
            disabled={fetchingStats}
            activeOpacity={0.7}
          >
            {fetchingStats ? (
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
            ) : (
              <Text style={styles.fetchBtnIcon}>🌐</Text>
            )}
            <Text style={styles.fetchBtnText}>
              {fetchingStats ? 'Fetching Stats...' : 'Fetch Stats from Web'}
            </Text>
          </TouchableOpacity>
          {fetchMessage !== '' && (
            <Text style={[styles.fetchMsg, fetchMessage.toLowerCase().includes('error') || fetchMessage.toLowerCase().includes('not found') || fetchMessage.toLowerCase().includes('failed') ? { color: Colors.error } : { color: Colors.green }]}>
              {fetchMessage}
            </Text>
          )}
          <Card style={{ marginBottom: 16 }}>
            <View style={styles.statsGrid}>
              {GAME_STAT_KEYS.map(([key, label]) => (
                <View key={key} style={styles.statInputWrap}>
                  <Text style={styles.statInputLabel}>{label}</Text>
                  <View style={styles.statInputBox}>
                    <Input
                      label=""
                      value={gameStats[key] || ''}
                      onChangeText={(v: string) => setGameStats({ ...gameStats, [key]: v.replace(/[^0-9]/g, '') })}
                      keyboardType="numeric"
                      style={{ marginBottom: 0 }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </Card>

          {/* SECTION: Notes */}
          <Text style={styles.section}>Notes</Text>
          <Card style={{ marginBottom: 16 }}>
            <Input label="Summary *" value={summary} onChangeText={setSummary} multiline numberOfLines={3} />
            <Input label="Strengths" value={strengths} onChangeText={setStrengths} multiline />
            <Input label="Weaknesses" value={weaknesses} onChangeText={setWeaknesses} multiline />
            <Input label="Development Areas" value={developmentAreas} onChangeText={setDevelopmentAreas} multiline />
            <Text style={styles.fieldLabel}>Overall Projection</Text>
            <View style={styles.chipRow}>
              {PROJECTIONS.map((p) => (
                <TouchableOpacity key={p} onPress={() => setOverallProjection(p)}
                  style={[styles.chip, overallProjection === p && styles.chipActive]}>
                  <Text style={[styles.chipText, overallProjection === p && { color: '#fff' }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          <TouchableOpacity onPress={() => router.replace('/(tabs)/dashboard')} style={styles.backToMainBtn}>
            <Text style={styles.backToMainText}>← Back to Main Page</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.stickyBottom}>
          <GradientButton title="Save Report" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  section: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  fieldLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statInputWrap: { width: '30%', minWidth: 90, marginBottom: 8 },
  statInputLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  statInputBox: { backgroundColor: Colors.elevated, borderRadius: 10, overflow: 'hidden' },
  fetchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, marginBottom: 10 },
  fetchBtnIcon: { fontSize: 18, marginRight: 8 },
  fetchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  fetchMsg: { fontSize: 13, marginBottom: 10, textAlign: 'center', paddingHorizontal: 8 },
  stickyBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: Colors.card, borderTopWidth: 1, borderTopColor: Colors.border },
  ratingGroupTitle: { fontSize: 14, fontWeight: '800', color: Colors.accent, letterSpacing: 1, marginBottom: 10, marginTop: 4, textTransform: 'uppercase' },
  ratingDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  backToMainBtn: { alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 16, backgroundColor: Colors.accent },
  backToMainText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  matchDateInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  matchDateInputError: { borderColor: Colors.error },
  matchDateErrorText: { color: Colors.error, fontSize: 12, marginBottom: 8, marginLeft: 4 },
});