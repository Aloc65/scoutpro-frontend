import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Platform, ActivityIndicator, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api } from '../../src/api/client';
import { Colors } from '../../src/theme/colors';
import { Player, Ratings, GameStats, GAME_STAT_KEYS, Meeting, MEETING_TYPE_LABELS, MeetingType, SIGNING_STATUS_LABELS } from '../../src/types';
import Card from '../../src/components/Card';
import RatingBar from '../../src/components/RatingBar';
import ProjectionBadge from '../../src/components/ProjectionBadge';
import GradientButton from '../../src/components/GradientButton';
import EmptyState from '../../src/components/EmptyState';
import MeetingForm from '../../src/components/MeetingForm';
import EditPlayerForm from '../../src/components/EditPlayerForm';
// DatePicker no longer used for DOB – using text input instead
import { getMeetingsByPlayer, createMeeting, updateMeeting, deleteMeeting } from '../../src/api/meetings';
import { useAuth } from '../../src/context/AuthContext';
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

/* ═══════════ General Notes Inline Editor ═══════════ */
function GeneralNotesSection({ player, playerId, isAdmin, onUpdated }: {
  player: Player;
  playerId: string;
  isAdmin: boolean;
  onUpdated: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(player.notes || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const CHARACTER_LIMIT = 1000;

  // Sync draft when player data refreshes (and not currently editing)
  useEffect(() => {
    if (!editing) setDraft(player.notes || '');
  }, [player.notes, editing]);

  const startEdit = () => {
    setDraft(player.notes || '');
    setMessage(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(player.notes || '');
    setEditing(false);
    setMessage(null);
  };

  const saveNotes = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.patch(`/api/players/${playerId}`, { notes: draft.trim() });
      await onUpdated();
      setEditing(false);
      setMessage({ type: 'success', text: 'Notes saved' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Failed to save notes' });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleBlur = () => {
    // Auto-save on blur if content changed
    const current = player.notes || '';
    if (draft.trim() !== current) {
      saveNotes();
    } else {
      setEditing(false);
    }
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      {/* Header */}
      <View style={notesStyles.header}>
        <View style={notesStyles.headerLeft}>
          <Ionicons name="document-text-outline" size={18} color={Colors.accent} />
          <Text style={notesStyles.sectionHeading}>General Notes</Text>
        </View>
        {isAdmin && !editing && (
          <TouchableOpacity style={notesStyles.editBtn} onPress={startEdit} activeOpacity={0.7}>
            <Ionicons name="pencil" size={14} color={Colors.accent} />
            <Text style={notesStyles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Message banner */}
      {message && (
        <View style={[notesStyles.messageBanner, message.type === 'success' ? notesStyles.messageSuccess : notesStyles.messageError]}>
          <Ionicons name={message.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={14} color="#fff" />
          <Text style={notesStyles.messageText}>{message.text}</Text>
        </View>
      )}

      {/* Edit mode */}
      {editing ? (
        <View>
          <TextInput
            style={notesStyles.textInput}
            value={draft}
            onChangeText={(t) => setDraft(t.slice(0, CHARACTER_LIMIT))}
            onBlur={handleBlur}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            placeholder="Add general notes about this player..."
            placeholderTextColor={Colors.textMuted}
            autoFocus
            editable={!saving}
          />
          <View style={notesStyles.editFooter}>
            <Text style={notesStyles.charCount}>{draft.length}/{CHARACTER_LIMIT}</Text>
            <View style={notesStyles.editActions}>
              <TouchableOpacity style={notesStyles.cancelBtn} onPress={cancelEdit} activeOpacity={0.7} disabled={saving}>
                <Text style={notesStyles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[notesStyles.saveBtn, saving && notesStyles.saveBtnDisabled]}
                onPress={saveNotes}
                activeOpacity={0.7}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={notesStyles.saveBtnText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        /* View mode */
        <TouchableOpacity
          activeOpacity={isAdmin ? 0.6 : 1}
          onPress={isAdmin ? startEdit : undefined}
          disabled={!isAdmin}
        >
          {player.notes ? (
            <Text style={notesStyles.notesText}>{player.notes}</Text>
          ) : (
            <Text style={notesStyles.placeholder}>
              {isAdmin ? 'No notes yet. Tap to add notes.' : 'No notes yet.'}
            </Text>
          )}
          {isAdmin && (
            <View style={notesStyles.tapHint}>
              <Ionicons name="pencil" size={11} color={Colors.textMuted} />
              <Text style={notesStyles.tapHintText}>Tap to edit</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </Card>
  );
}

const notesStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
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
  editBtnText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  messageSuccess: {
    backgroundColor: 'rgba(34,197,94,0.2)',
  },
  messageError: {
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  textInput: {
    backgroundColor: Colors.elevated,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 10,
    padding: 14,
    minHeight: 120,
    maxHeight: 300,
  },
  editFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  notesText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  placeholder: {
    fontSize: 14,
    color: Colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    opacity: 0.5,
  },
  tapHintText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
});

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [player, setPlayer] = useState<Player | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [avgRatings, setAvgRatings] = useState<Ratings | null>(null);
  const [gameStatTotals, setGameStatTotals] = useState<GameStats | null>(null);
  const [gameStatAverages, setGameStatAverages] = useState<GameStats | null>(null);
  const [gamesWithStats, setGamesWithStats] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Edit player state
  const [editFormVisible, setEditFormVisible] = useState(false);

  // Inline DOB editing state (text input with DD/MM/YYYY)
  const [dobEditing, setDobEditing] = useState(false);
  const [dobInputValue, setDobInputValue] = useState('');
  const [dobSaving, setDobSaving] = useState(false);
  const [dobMessage, setDobMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);

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

  // Open DOB text input for editing
  const startDobEdit = () => {
    const currentDob = player?.dateOfBirth ? formatDateAU(player.dateOfBirth) : '';
    setDobInputValue(currentDob);
    setDobError(null);
    setDobMessage(null);
    setDobEditing(true);
  };

  // Validate DD/MM/YYYY format
  const validateDobInput = (value: string): string | null => {
    if (!value.trim()) return 'Date of birth is required';
    const formatRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!formatRegex.test(value)) return 'Invalid format. Use DD/MM/YYYY';
    const [dd, mm, yyyy] = value.split('/').map(Number);
    if (mm < 1 || mm > 12) return 'Invalid month (01-12)';
    if (dd < 1 || dd > 31) return 'Invalid day (01-31)';
    if (yyyy < 1990 || yyyy > 2015) return 'Year must be between 1990 and 2015';
    // Check valid date (e.g. Feb 30 would be invalid)
    const dateObj = new Date(yyyy, mm - 1, dd);
    if (dateObj.getFullYear() !== yyyy || dateObj.getMonth() !== mm - 1 || dateObj.getDate() !== dd) {
      return 'Invalid date';
    }
    return null;
  };

  // Parse DD/MM/YYYY to ISO date string YYYY-MM-DD
  const parseDobToISO = (value: string): string => {
    const [dd, mm, yyyy] = value.split('/');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Save DOB from text input
  const saveDob = async () => {
    const validationError = validateDobInput(dobInputValue);
    if (validationError) {
      setDobError(validationError);
      return;
    }
    setDobError(null);
    setDobEditing(false);
    setDobSaving(true);
    setDobMessage(null);
    try {
      const isoDate = parseDobToISO(dobInputValue);
      await api.patch(`/api/players/${id}`, { dateOfBirth: isoDate });
      await load(); // Reload player data – age & draft year recalculate on server
      setDobMessage({ type: 'success', text: 'DOB updated successfully' });
      setTimeout(() => setDobMessage(null), 3000);
    } catch (e: any) {
      const msg = e.message || 'Failed to update DOB';
      setDobMessage({ type: 'error', text: msg });
      setTimeout(() => setDobMessage(null), 5000);
    } finally {
      setDobSaving(false);
    }
  };

  // Cancel DOB editing on ESC or no changes
  const cancelDobEdit = () => {
    setDobEditing(false);
    setDobError(null);
  };

  // Handle blur – save if value changed, cancel if unchanged
  const handleDobBlur = () => {
    const currentDob = player?.dateOfBirth ? formatDateAU(player.dateOfBirth) : '';
    if (dobInputValue === currentDob) {
      cancelDobEdit();
    } else {
      saveDob();
    }
  };

  // Handle key press in DOB input
  const handleDobKeyPress = (e: any) => {
    if (e.nativeEvent.key === 'Enter') {
      saveDob();
    } else if (e.nativeEvent.key === 'Escape') {
      cancelDobEdit();
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

          {/* ── DOB / Age / Draft Year row ── */}
          <View style={styles.dobRow}>
            {/* DOB – tappable text input for ADMIN users */}
            {isAdmin && !dobEditing ? (
              <TouchableOpacity
                style={styles.dobItem}
                onPress={startDobEdit}
                activeOpacity={0.6}
                disabled={dobSaving}
              >
                <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
                <Text style={styles.dobLabel}>DOB</Text>
                {dobSaving ? (
                  <ActivityIndicator size="small" color={Colors.accent} style={{ marginLeft: 4 }} />
                ) : (
                  <Text style={[styles.dobValue, styles.dobValueEditable]}>
                    {player.dateOfBirth ? formatDateAU(player.dateOfBirth) : 'Not set'}
                  </Text>
                )}
                <Ionicons name="pencil" size={12} color={Colors.accent} style={{ marginLeft: 3, opacity: 0.7 }} />
              </TouchableOpacity>
            ) : isAdmin && dobEditing ? (
              <View style={styles.dobEditContainer}>
                <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
                <Text style={styles.dobLabel}>DOB</Text>
                <TextInput
                  style={[styles.dobTextInput, dobError ? styles.dobTextInputError : null]}
                  value={dobInputValue}
                  onChangeText={(text) => { setDobInputValue(text); setDobError(null); }}
                  onBlur={handleDobBlur}
                  onKeyPress={handleDobKeyPress}
                  onSubmitEditing={saveDob}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                  autoFocus
                  selectTextOnFocus
                  returnKeyType="done"
                />
                <TouchableOpacity onPress={saveDob} activeOpacity={0.7} style={styles.dobSaveBtn}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.green} />
                </TouchableOpacity>
                <TouchableOpacity onPress={cancelDobEdit} activeOpacity={0.7} style={styles.dobCancelBtn}>
                  <Ionicons name="close-circle" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.dobItem}>
                <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
                <Text style={styles.dobLabel}>DOB</Text>
                <Text style={styles.dobValue}>
                  {player.dateOfBirth ? formatDateAU(player.dateOfBirth) : 'Not set'}
                </Text>
              </View>
            )}
            {player.age != null && (
              <>
                <View style={styles.dobDivider} />
                <View style={styles.dobItem}>
                  <Ionicons name="person-outline" size={14} color={Colors.accent} />
                  <Text style={styles.dobLabel}>Age</Text>
                  <Text style={styles.dobValue}>{player.age}yo</Text>
                </View>
              </>
            )}
            {player.draftYear != null && (
              <>
                <View style={styles.dobDivider} />
                <View style={styles.dobItem}>
                  <Ionicons name="trophy-outline" size={14} color={Colors.accent} />
                  <Text style={styles.dobLabel}>Draft Year</Text>
                  <Text style={styles.dobValue}>{player.draftYear}</Text>
                </View>
              </>
            )}
          </View>

          {/* DOB validation error */}
          {dobError && dobEditing && (
            <View style={styles.dobErrorBanner}>
              <Ionicons name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.dobErrorText}>{dobError}</Text>
            </View>
          )}

          {/* DOB success/error message */}
          {dobMessage && (
            <View style={[styles.dobMessageBanner, dobMessage.type === 'success' ? styles.dobMessageSuccess : styles.dobMessageError]}>
              <Ionicons
                name={dobMessage.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color="#fff"
              />
              <Text style={styles.dobMessageText}>{dobMessage.text}</Text>
            </View>
          )}

          {/* ── Other player details ── */}
          <Text style={styles.info}>
            {[
              player.competition,
              player.dominantFoot,
              player.height ? `${player.height}cm` : null,
              player.weight ? `${player.weight}kg` : null,
            ].filter(Boolean).join(' • ')}
          </Text>

          {/* ── Badges row ── */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {player.draftYear && (
              <View style={styles.draftYearBadge}>
                <Ionicons name="calendar-outline" size={14} color={Colors.accent} />
                <Text style={styles.draftYearText}>{player.draftYear} Draft</Text>
              </View>
            )}
            <View style={player.signingStatus === 'SIGNED' ? styles.signingBadgeSigned : styles.signingBadgeNotSigned}>
              <Ionicons
                name={player.signingStatus === 'SIGNED' ? 'checkmark-circle' : 'remove-circle'}
                size={14}
                color="#fff"
              />
              <Text style={styles.signingBadgeText}>
                {SIGNING_STATUS_LABELS[player.signingStatus] || 'Not Signed'}
              </Text>
            </View>
          </View>
        </Card>

        {/* ═══════════ GENERAL NOTES SECTION ═══════════ */}
        <GeneralNotesSection
          player={player}
          playerId={id!}
          isAdmin={isAdmin}
          onUpdated={load}
        />

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
  dobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
    flexWrap: 'wrap',
    gap: 4,
  },
  dobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dobLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dobValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  dobValueEditable: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dashed',
    textDecorationColor: Colors.accent,
    color: Colors.accent,
  },
  dobMessageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  dobMessageSuccess: {
    backgroundColor: 'rgba(34,197,94,0.2)',
  },
  dobMessageError: {
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  dobMessageText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  dobEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  dobTextInput: {
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 110,
    textAlign: 'center',
  },
  dobTextInputError: {
    borderColor: Colors.error,
  },
  dobSaveBtn: {
    padding: 4,
  },
  dobCancelBtn: {
    padding: 4,
  },
  dobErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
  },
  dobErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  dobDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: 10,
  },
  draftYearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  draftYearText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
  },
  signingBadgeSigned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.green,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  signingBadgeNotSigned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.orange,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  signingBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
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
