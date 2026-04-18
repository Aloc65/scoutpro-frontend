import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api } from '../../../src/api/client';
import { useAuth } from '../../../src/context/AuthContext';
import { Colors, ratingColor } from '../../../src/theme/colors';
import { FullReport, COMPETITIONS, POSITIONS, PROJECTIONS, GAME_STAT_KEYS, Player, SIGNING_STATUS_LABELS, SigningStatus } from '../../../src/types';
import Input from '../../../src/components/Input';
import GradientButton from '../../../src/components/GradientButton';
import Card from '../../../src/components/Card';
import RatingBar from '../../../src/components/RatingBar';
import ProjectionBadge from '../../../src/components/ProjectionBadge';
import DatePicker from '../../../src/components/DatePicker';
import { OTHER_OPPONENT_OPTION, WAFL_TEAMS } from '../../../src/constants/waflTeams';

import { showAlert, showConfirm } from '../../../src/utils/alert';
import { Ionicons } from '@expo/vector-icons';
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
    <View style={{ marginBottom: 12 }}>
      <TouchableOpacity
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.elevated, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 }}
        onPress={() => setOpen(!open)} activeOpacity={0.7}
      >
        <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color, fontWeight: '700', fontSize: 16 }}>{value.toFixed(1)}</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 10 }}>{open ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>
      {open && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, paddingHorizontal: 4 }}>
          {RATING_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: opt === value ? color : Colors.elevated, borderWidth: 1, borderColor: Colors.border, minWidth: 52, alignItems: 'center' }}
              onPress={() => { onChange(opt); setOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 14, color: opt === value ? '#fff' : Colors.textSecondary, fontWeight: opt === value ? '700' : '600' }}>{opt.toFixed(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function EditReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [report, setReport] = useState<FullReport | null>(null);
  const [playerSigningStatus, setPlayerSigningStatus] = useState<SigningStatus | null>(null);
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [matchDate, setMatchDate] = useState('');
  const [selectedOpponentOption, setSelectedOpponentOption] = useState('');
  const [customOpponent, setCustomOpponent] = useState('');
  const [showOpponentDropdown, setShowOpponentDropdown] = useState(false);
  const [venue, setVenue] = useState('');
  const [competition, setCompetition] = useState('');

  const [positionsPlayed, setPositionsPlayed] = useState<string[]>([]);
  const [primaryPosition, setPrimaryPosition] = useState('');
  const [summary, setSummary] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [developmentAreas, setDevelopmentAreas] = useState('');
  const [overallProjection, setOverallProjection] = useState('');
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [gameStats, setGameStats] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [fetchingStats, setFetchingStats] = useState(false);
  const [fetchMessage, setFetchMessage] = useState('');

  const isoToDatePickerValue = (iso: string): string => {
    if (!iso) return '';
    const [dateOnly] = iso.split('T');
    return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : '';
  };

  const isoToDDMMYYYY = (iso: string): string => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const opponent = useMemo(() => {
    if (selectedOpponentOption === OTHER_OPPONENT_OPTION) {
      return customOpponent.trim();
    }
    return selectedOpponentOption;
  }, [selectedOpponentOption, customOpponent]);

  const fetchStatsFromWeb = async () => {
    if (!report) return;
    if (!opponent) {
      showAlert('Missing Info', 'Please select or enter the opponent');
      return;
    }
    if (!matchDate) {
      showAlert('Missing Info', 'Please select the match date');
      return;
    }
    try {
      setFetchingStats(true);
      setFetchMessage('');
      const result = await api.post<any>('/api/stats-fetcher/fetch', {
        playerName: report.playerName,
        team: report.playerTeam || undefined,
        opponent,
        matchDate,
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
        if (result.dateOfBirth && report.playerId) {
          try {
            await api.patch(`/api/players/${report.playerId}`, { dateOfBirth: result.dateOfBirth });
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
    api.get<{ report: FullReport }>(`/api/reports/${id}`).then((d) => {
      const r = d.report;
      setReport(r);
      // Fetch player signing status
      if (r.playerId) {
        api.get<{ player: Player }>(`/api/players/${r.playerId}`).then((pd) => {
          setPlayerSigningStatus(pd.player.signingStatus);
        }).catch(() => {});
      }
      setMatchDate(r.matchDate ? isoToDatePickerValue(r.matchDate) : '');
      if (WAFL_TEAMS.includes(r.opponent as (typeof WAFL_TEAMS)[number])) {
        setSelectedOpponentOption(r.opponent);
        setCustomOpponent('');
      } else {
        setSelectedOpponentOption(r.opponent ? OTHER_OPPONENT_OPTION : '');
        setCustomOpponent(r.opponent || '');
      }
      setShowOpponentDropdown(false);
      setVenue(r.venue || '');
      setCompetition(r.competition || '');
      setPositionsPlayed(r.positionsPlayed);
      setPrimaryPosition(r.primaryPosition);
      setSummary(r.summary);
      setStrengths(r.strengths || '');
      setWeaknesses(r.weaknesses || '');
      setDevelopmentAreas(r.developmentAreas || '');
      setOverallProjection(r.overallProjection || '');
      const rat: Record<string, number> = {};
      RATING_KEYS.forEach(([key]) => { rat[key] = (r.ratings as any)?.[key] ?? 3; });
      setRatings(rat);
      const gs: Record<string, string> = {};
      GAME_STAT_KEYS.forEach(([key]) => { gs[key] = (r as any)[key] != null ? String((r as any)[key]) : ''; });
      setGameStats(gs);
    }).catch(() => {});
  }, [id]);

  const canEdit = user?.role === 'ADMIN' || user?.id === report?.scoutId;
  const canDelete = user?.role === 'ADMIN' || user?.id === report?.scoutId;

  const togglePos = (p: string) => {
    if (positionsPlayed.includes(p)) {
      setPositionsPlayed(positionsPlayed.filter((x) => x !== p));
      if (primaryPosition === p) setPrimaryPosition('');
    } else {
      setPositionsPlayed([...positionsPlayed, p]);
    }
  };

  const save = async () => {
    if (!matchDate || !opponent) {
      showAlert('Validation', 'Please select the match date and opponent');
      return;
    }
    try {
      setSaving(true);
      const statsPayload: any = {};
      GAME_STAT_KEYS.forEach(([key]) => {
        const v = gameStats[key];
        if (v !== undefined && v !== '') statsPayload[key] = parseInt(v, 10);
        else statsPayload[key] = null;
      });
      await api.patch(`/api/reports/${id}`, {
        matchDate: new Date(matchDate).toISOString(),
        opponent, venue: venue || undefined, competition: competition || undefined,
        positionsPlayed, primaryPosition, summary,
        strengths: strengths || undefined, weaknesses: weaknesses || undefined,
        developmentAreas: developmentAreas || undefined,
        overallProjection: overallProjection || undefined,
        ...statsPayload,
        ratings,
      });
      showAlert('Saved', 'Report updated!');
      setEditing(false);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const deleteReport = () => {
    showConfirm('Delete Report', 'Are you sure?', async () => {
      await api.delete(`/api/reports/${id}`);
      router.back();
    });
  };

  if (!report) return <View style={styles.container} />;

  // VIEW mode
  if (!editing) {
    return (
      <>
        <Stack.Screen options={{ title: `Report: ${report.playerName}`, headerStyle: { backgroundColor: Colors.card }, headerTintColor: Colors.text }} />
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.title}>{report.playerName}</Text>
            <Text style={styles.meta}>vs {report.opponent} • {isoToDDMMYYYY(report.matchDate)}</Text>
            <Text style={styles.meta}>Scout: {report.scoutName} • {report.primaryPosition}</Text>
            {report.venue && <Text style={styles.meta}>📍 {report.venue}</Text>}
            {report.result && <Text style={styles.meta}>Result: {report.result}</Text>}
            {report.minutesPlayed && <Text style={styles.meta}>Minutes: {report.minutesPlayed}</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <ProjectionBadge value={report.overallProjection} />
              {playerSigningStatus && (
                <View style={playerSigningStatus === 'SIGNED' ? styles.signingBadgeSigned : styles.signingBadgeNotSigned}>
                  <Ionicons
                    name={playerSigningStatus === 'SIGNED' ? 'checkmark-circle' : 'remove-circle'}
                    size={13}
                    color="#fff"
                  />
                  <Text style={styles.signingBadgeText}>
                    {SIGNING_STATUS_LABELS[playerSigningStatus]}
                  </Text>
                </View>
              )}
            </View>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>Ratings</Text>
            <Text style={styles.ratingGroupTitle}>FUNDAMENTALS</Text>
            {FUNDAMENTALS_KEYS.map(([key, label]) => (
              <RatingBar key={key} label={label} value={(report.ratings as any)?.[key]} />
            ))}
            <View style={styles.ratingDivider} />
            <Text style={styles.ratingGroupTitle}>TRAITS</Text>
            {TRAITS_KEYS.map(([key, label]) => (
              <RatingBar key={key} label={label} value={(report.ratings as any)?.[key]} />
            ))}
          </Card>

          {GAME_STAT_KEYS.some(([key]) => (report as any)[key] != null) && (
            <Card style={{ marginBottom: 16 }}>
              <Text style={styles.sectionTitle}>Game Stats</Text>
              <View style={styles.statsViewGrid}>
                {GAME_STAT_KEYS.map(([key, label]) => (
                  <View key={key} style={styles.statViewItem}>
                    <Text style={styles.statViewValue}>{(report as any)[key] != null ? (report as any)[key] : '—'}</Text>
                    <Text style={styles.statViewLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.body}>{report.summary}</Text>
            {report.strengths && <><Text style={styles.subTitle}>Strengths</Text><Text style={styles.body}>{report.strengths}</Text></>}
            {report.weaknesses && <><Text style={styles.subTitle}>Weaknesses</Text><Text style={styles.body}>{report.weaknesses}</Text></>}
            {report.developmentAreas && <><Text style={styles.subTitle}>Development Areas</Text><Text style={styles.body}>{report.developmentAreas}</Text></>}
          </Card>

          {canEdit && <GradientButton title="Edit Report" onPress={() => setEditing(true)} style={{ marginBottom: 12 }} />}
          {canDelete && (
            <TouchableOpacity onPress={deleteReport} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>Delete Report</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.replace('/(tabs)/dashboard')} style={styles.backToMainBtn}>
            <Text style={styles.backToMainText}>← Back to Main Page</Text>
          </TouchableOpacity>
        </ScrollView>
      </>
    );
  }

  // EDIT mode
  return (
    <>
      <Stack.Screen options={{ title: 'Edit Report', headerStyle: { backgroundColor: Colors.card }, headerTintColor: Colors.text }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>Match Info</Text>
          <Card style={{ marginBottom: 16 }}>
            <DatePicker label="Match Date *" value={matchDate} onChange={setMatchDate} />
            <Text style={styles.fieldLabel}>Opponent *</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowOpponentDropdown((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dropdownText, !selectedOpponentOption && styles.dropdownPlaceholder]}>
                {selectedOpponentOption || 'Select opponent'}
              </Text>
              <Text style={styles.dropdownArrow}>{showOpponentDropdown ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showOpponentDropdown && (
              <View style={styles.dropdownList}>
                {[...WAFL_TEAMS, OTHER_OPPONENT_OPTION].map((team) => (
                  <TouchableOpacity
                    key={team}
                    style={[styles.dropdownItem, selectedOpponentOption === team && styles.dropdownItemSelected]}
                    onPress={() => {
                      setSelectedOpponentOption(team);
                      if (team !== OTHER_OPPONENT_OPTION) {
                        setCustomOpponent('');
                      }
                      setShowOpponentDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, selectedOpponentOption === team && styles.dropdownItemTextSelected]}>
                      {team}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {selectedOpponentOption === OTHER_OPPONENT_OPTION && (
              <Input label="Other Opponent *" value={customOpponent} onChangeText={setCustomOpponent} />
            )}
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

          <Text style={styles.section}>Positions</Text>
          <Card style={{ marginBottom: 16 }}>
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

          <Text style={styles.section}>Ratings</Text>
          <Card style={{ marginBottom: 16 }}>
            <Text style={styles.ratingGroupTitle}>FUNDAMENTALS</Text>
            {FUNDAMENTALS_KEYS.map(([key, label]) => (
              <RatingDropdown key={key} label={label} value={ratings[key] ?? 3} onChange={(v) => setRatings({ ...ratings, [key]: v })} />
            ))}
            <View style={styles.ratingDivider} />
            <Text style={styles.ratingGroupTitle}>TRAITS</Text>
            {TRAITS_KEYS.map(([key, label]) => (
              <RatingDropdown key={key} label={label} value={ratings[key] ?? 3} onChange={(v) => setRatings({ ...ratings, [key]: v })} />
            ))}
          </Card>

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
        </ScrollView>

        <View style={styles.stickyBottom}>
          <GradientButton title="Save Changes" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  subTitle: { fontSize: 14, fontWeight: '700', color: Colors.accent, marginTop: 12, marginBottom: 4 },
  body: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  section: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  fieldLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  statsViewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statViewItem: { width: '30%', minWidth: 90, backgroundColor: Colors.elevated, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statViewValue: { fontSize: 22, fontWeight: '800', color: Colors.accent },
  statViewLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 4, fontWeight: '600' },
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
  deleteBtn: { alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: Colors.error },
  deleteText: { color: '#fff', fontWeight: '700' },
  backToMainBtn: { alignItems: 'center', padding: 14, borderRadius: 12, marginTop: 12, backgroundColor: Colors.accent },
  backToMainText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  signingBadgeSigned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.green,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  signingBadgeNotSigned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.orange,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  signingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  dropdown: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dropdownText: { fontSize: 15, color: Colors.text },
  dropdownPlaceholder: { color: Colors.textMuted },
  dropdownArrow: { color: Colors.textMuted, fontSize: 10 },
  dropdownList: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: -2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemSelected: { backgroundColor: 'rgba(79, 70, 229, 0.15)' },
  dropdownItemText: { fontSize: 15, color: Colors.text },
  dropdownItemTextSelected: { color: Colors.primary, fontWeight: '700' },
});