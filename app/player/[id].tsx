import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Platform, ActivityIndicator, TextInput, Image } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api } from '../../src/api/client';
import { Colors } from '../../src/theme/colors';
import {
  Player,
  Ratings,
  GAME_STAT_KEYS,
  ContactLogEntry,
  CONTACT_TYPE_LABELS,
  ContactType,
  SIGNING_STATUS_LABELS,
  ChampionDataPlayerResponse,
  NationalChampionshipsPlayerResponse,
  WatchList,
  isContactAllowed,
} from '../../src/types';
import Card from '../../src/components/Card';
import RatingBar from '../../src/components/RatingBar';
import ContactPermissionBadge from '../../src/components/ContactPermissionBadge';
import ContactPermissionSection from '../../src/features/players/ContactPermissionSection';
import { overallRatingLabel } from '../../src/features/watchlist/pipeline';
import ProjectionBadge from '../../src/components/ProjectionBadge';
import GradientButton from '../../src/components/GradientButton';
import EmptyState from '../../src/components/EmptyState';
import ContactForm, { ContactFormData } from '../../src/components/ContactForm';
import EditPlayerForm from '../../src/components/EditPlayerForm';
import PositionalAnalysis from '../../src/components/PositionalAnalysis';
import AflPlayerComparison from '../../src/components/AflPlayerComparison';
// DatePicker no longer used for DOB – using text input instead
import { getContactLog, createContactLogEntry, updateContactLogEntry, deleteContactLogEntry } from '../../src/api/contactLog';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { downloadReportPdf } from '../../src/utils/downloadReportPdf';

const FUNDAMENTALS_LABELS: [keyof Ratings, string][] = [
  ['kicking', 'Kicking'], ['handball', 'Handball'], ['marking', 'Marking'],
  ['cleanBelowKnees', 'Clean Below Knees'], ['contestWork', 'Contested Work'], ['speed', 'Speed'],
];

const TRAITS_LABELS: [keyof Ratings, string][] = [
  ['workRate', 'Work Rate'], ['decisionMaking', 'Decision Making'], ['composure', 'Composure'],
  ['flexibility', 'Flexibility'], ['defensiveEffort', 'Defensive Effort'],
  ['gameAwareness', 'Game Awareness'],
];

const RATING_LABELS: [keyof Ratings, string][] = [...FUNDAMENTALS_LABELS, ...TRAITS_LABELS];

const CONTACT_TYPE_ICONS: Record<ContactType, string> = {
  INITIAL: 'person-add-outline',
  FOLLOW_UP: 'refresh-outline',
  CONTRACT: 'document-text-outline',
  REVIEW: 'clipboard-outline',
  OTHER: 'ellipsis-horizontal-outline',
};

const CONTACT_TYPE_COLORS: Record<ContactType, string> = {
  INITIAL: Colors.accent,
  FOLLOW_UP: Colors.primary,
  CONTRACT: Colors.amber,
  REVIEW: Colors.green,
  OTHER: Colors.textSecondary,
};

function formatChampionValue(value: unknown, key: string): string {
  if (value === null || value === undefined || value === '') return '—';

  if (key === 'matchDate' && typeof value === 'string') {
    return new Date(value).toLocaleDateString();
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
  }

  return String(value);
}

function formatDateAU(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function calculateAgeFromDateOfBirth(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age;
}

function getViewingMethodMeta(viewingMethod?: string | null): { label: string; icon: string; color: string } {
  if (viewingMethod === 'OFF_VISION') {
    return { label: 'Off Vision', icon: '📹', color: Colors.primary };
  }

  return { label: 'Live', icon: '🎥', color: Colors.green };
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
  const canEditNotes = user?.role === 'ADMIN' || user?.role === 'SCOUT';
  const [photoFetching, setPhotoFetching] = useState(false);
  const [player, setPlayer] = useState<Player | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [avgRatings, setAvgRatings] = useState<Ratings | null>(null);
  const [championColumns, setChampionColumns] = useState<Array<{ key: string; label: string }>>([]);
  const [championSeasonAverages, setChampionSeasonAverages] = useState<Array<{ season: number | null; grade?: string; gradeDisplayName?: string; rows: number; averages: Record<string, number | null> }>>([]);
  const [natChampColumns, setNatChampColumns] = useState<Array<{ key: string; label: string }>>([]);
  const [natChampSeasonAverages, setNatChampSeasonAverages] = useState<Array<{ season: number | null; grade?: string; gradeDisplayName?: string; rows: number; averages: Record<string, number | null> }>>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Edit player state
  const [editFormVisible, setEditFormVisible] = useState(false);

  // Inline DOB editing state (text input with DD/MM/YYYY)
  const [dobEditing, setDobEditing] = useState(false);
  const [dobInputValue, setDobInputValue] = useState('');
  const [dobSaving, setDobSaving] = useState(false);
  const [dobMessage, setDobMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dobError, setDobError] = useState<string | null>(null);

  // Contact history state
  const [contactLog, setContactLog] = useState<ContactLogEntry[]>([]);
  const [contactFormVisible, setContactFormVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ContactLogEntry | null>(null);

  // Watch list state
  const [watchListEntry, setWatchListEntry] = useState<WatchList | null>(null);
  const [watchListLoading, setWatchListLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, championData, natChampData, watchStatus] = await Promise.all([
        api.get<{ player: Player; reports: any[]; averageRatings: Ratings }>(`/api/players/${id}`),
        api.get<ChampionDataPlayerResponse>(`/api/champion-data/player/${id}`).catch(() => null),
        api.get<NationalChampionshipsPlayerResponse>(`/api/national-championships/player/${id}`).catch(() => null),
        api.get<{ inWatchList: boolean; entry: WatchList | null }>(`/api/watch-list/player/${id}`).catch(() => ({ inWatchList: false, entry: null })),
      ]);

      setPlayer(d.player);
      setReports(d.reports);
      setAvgRatings(d.averageRatings);
      setWatchListEntry(watchStatus?.entry || null);

      if (championData) {
        setChampionColumns(championData.columns || []);
        setChampionSeasonAverages(championData.seasonAverages || []);
      } else {
        setChampionColumns([]);
        setChampionSeasonAverages([]);
      }

      if (natChampData) {
        setNatChampColumns(natChampData.columns || []);
        setNatChampSeasonAverages(natChampData.seasonAverages || []);
      } else {
        setNatChampColumns([]);
        setNatChampSeasonAverages([]);
      }
    } catch {}
  }, [id]);

  const loadContactLog = useCallback(async () => {
    try {
      const entries = await getContactLog(id!);
      // Backend returns most recent first; keep defensive sort.
      const sorted = [...entries].sort((a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );
      setContactLog(sorted);
    } catch {
      // Contact-log endpoint may not exist yet - gracefully handle
      setContactLog([]);
    }
  }, [id]);

  useEffect(() => { load(); loadContactLog(); }, [load, loadContactLog]);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadContactLog()]);
    setRefreshing(false);
  };

  const handleSaveContact = async (data: ContactFormData) => {
    if (editingEntry) {
      await updateContactLogEntry(id!, editingEntry.id, data);
    } else {
      await createContactLogEntry(id!, data);
    }
    setContactFormVisible(false);
    setEditingEntry(null);
    await loadContactLog();
  };

  const handleEditContact = (entry: ContactLogEntry) => {
    setEditingEntry(entry);
    setContactFormVisible(true);
  };

  const handleDeleteContact = (entry: ContactLogEntry) => {
    const doDelete = async () => {
      try {
        await deleteContactLogEntry(id!, entry.id);
        await loadContactLog();
      } catch (e: any) {
        const msg = e.message || 'Failed to delete contact entry';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Error', msg);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this contact entry?')) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Contact',
        'Are you sure you want to delete this contact entry?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const openAddContact = () => {
    setEditingEntry(null);
    setContactFormVisible(true);
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

  const handleFetchPhoto = async () => {
    if (!player) return;
    setPhotoFetching(true);
    try {
      const result = await api.post<{ success: boolean; photoUrl: string | null; message: string }>(`/api/players/${player.id}/fetch-photo`);
      if (result.success && result.photoUrl) {
        setPlayer({ ...player, photoUrl: result.photoUrl });
        if (Platform.OS === 'web') window.alert('Photo updated!');
        else Alert.alert('Success', 'Photo updated!');
      } else {
        if (Platform.OS === 'web') window.alert(result.message);
        else Alert.alert('Not Found', result.message);
      }
    } catch (e) {
      const msg = 'Failed to fetch photo';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setPhotoFetching(false);
    }
  };

  const toggleWatchList = async () => {
    try {
      setWatchListLoading(true);

      if (watchListEntry) {
        await api.delete(`/api/watch-list/${watchListEntry.id}`);
        setWatchListEntry(null);
      } else {
        const created = await api.post<WatchList>('/api/watch-list', {
          playerId: id,
          signedStatus: 'Unsigned',
          aflTeamsInterested: [],
        });
        setWatchListEntry(created);
      }
    } catch (e: any) {
      const msg = e.message || 'Failed to update watch list';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setWatchListLoading(false);
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

  const dynamicAge = calculateAgeFromDateOfBirth(player.dateOfBirth);

  const championAverageColumns = championColumns.filter((column) => (
    championSeasonAverages.length > 0
      ? Object.prototype.hasOwnProperty.call(championSeasonAverages[0].averages, column.key)
      : false
  ));

  const natChampAverageColumns = natChampColumns.filter((column) => (
    natChampSeasonAverages.length > 0
      ? Object.prototype.hasOwnProperty.call(natChampSeasonAverages[0].averages, column.key)
      : false
  ));
  return (
    <>
      <Stack.Screen options={{ title: player.fullName, headerStyle: { backgroundColor: Colors.card }, headerTintColor: Colors.text }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <Card style={{ marginBottom: 16 }}>
          <View style={styles.profileTopRow}>
            {/* Player Photo */}
            <View>
              {player.photoUrl ? (
                <Image
                  source={{ uri: player.photoUrl }}
                  style={styles.playerPhoto}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.playerPhotoPlaceholder}>
                  <Ionicons name="person" size={32} color={Colors.textMuted} />
                </View>
              )}
              {isAdmin && (
                <TouchableOpacity
                  style={styles.fetchPhotoBtn}
                  onPress={handleFetchPhoto}
                  disabled={photoFetching}
                  activeOpacity={0.7}
                >
                  {photoFetching ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <Ionicons name="camera-outline" size={14} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.profileInfo}>
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
              {/* Agent-contact permission — most prominent status, directly under the name */}
              <View style={styles.permissionBadgeRow}>
                <ContactPermissionBadge permission={player.contactPermission} size="lg" />
              </View>
              {player.team && <Text style={styles.info}>🏢 {player.team}</Text>}
            </View>
          </View>

          <TouchableOpacity
            style={watchListEntry ? styles.watchListBtnActive : styles.watchListBtn}
            onPress={toggleWatchList}
            activeOpacity={0.8}
            disabled={watchListLoading}
          >
            {watchListLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={watchListEntry ? 'bookmark' : 'bookmark-outline'}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.watchListBtnText}>
                  {watchListEntry ? 'Remove from Watch List' : 'Add to Watch List'}
                </Text>
              </>
            )}
          </TouchableOpacity>

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
            {dynamicAge != null && (
              <>
                <View style={styles.dobDivider} />
                <View style={styles.dobItem}>
                  <Ionicons name="person-outline" size={14} color={Colors.accent} />
                  <Text style={styles.dobLabel}>Age</Text>
                  <Text style={styles.dobValue}>{dynamicAge}</Text>
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
            {player.state && (
              <>
                <View style={styles.dobDivider} />
                <View style={styles.dobItem}>
                  <Ionicons name="location-outline" size={14} color={Colors.accent} />
                  <Text style={styles.dobLabel}>State</Text>
                  <Text style={styles.dobValue}>{player.state}</Text>
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
              player.customCompetition || player.competition,
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

        {/* ═══════════ AGENT CONTACT PERMISSION SECTION ═══════════ */}
        <ContactPermissionSection
          player={player}
          playerId={id!}
          canManage={canEditNotes}
          onUpdated={load}
        />

        {/* ═══════════ GENERAL NOTES SECTION ═══════════ */}
        <GeneralNotesSection
          player={player}
          playerId={id!}
          isAdmin={canEditNotes}
          onUpdated={load}
        />

        {avgRatings && (
          <Card style={{ marginBottom: 16 }}>
            <View style={styles.ratingHeaderRow}>
              <Text style={styles.sectionTitle}>Average Ratings</Text>
              {(() => {
                const vals = RATING_LABELS
                  .map(([key]) => avgRatings[key] as number | null)
                  .filter((v): v is number => v != null);
                const overall = vals.length
                  ? vals.reduce((a, b) => a + b, 0) / vals.length
                  : null;
                return (
                  <View style={styles.overallRatingBadge}>
                    <Text style={styles.overallRatingLabel}>Overall</Text>
                    <Text style={styles.overallRatingValue}>{overallRatingLabel(overall)}</Text>
                  </View>
                );
              })()}
            </View>
            <Text style={styles.ratingGroupTitle}>FUNDAMENTALS</Text>
            {FUNDAMENTALS_LABELS.map(([key, label]) => (
              <RatingBar key={key} label={label} value={avgRatings[key] as number | null} />
            ))}
            <View style={styles.ratingDivider} />
            <Text style={styles.ratingGroupTitle}>TRAITS</Text>
            {TRAITS_LABELS.map(([key, label]) => (
              <RatingBar key={key} label={label} value={avgRatings[key] as number | null} />
            ))}
          </Card>
        )}

        {/*
          Statistics on the player profile come exclusively from Champion Data.
          The two sections below are the only statistical sections:
            1. Champion Data (current season league play)
            2. National Championships
          Previously displayed report-derived "Season Totals" and "Averages Per
          Game" (sourced from WAFL website data) have been intentionally removed.
        */}

        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>Champion Data Stats - Season Averages</Text>
          <Text style={styles.statsAverageNote}>(All statistics shown are averages per game)</Text>
          {championSeasonAverages.length === 0 || championAverageColumns.length === 0 ? (
            <Text style={styles.statsSubtitle}>No Champion Data season averages imported for this player yet.</Text>
          ) : (
            <View style={styles.championSeasonTableWrap}>
              {championSeasonAverages.map((seasonRow) => (
                <View key={`season-${seasonRow.season ?? 'unknown'}-${seasonRow.grade ?? 'unknown'}`} style={styles.championSeasonCard}>
                  <Text style={styles.championSeasonHeading}>
                    {seasonRow.season ?? 'Unknown'} - {seasonRow.gradeDisplayName || seasonRow.grade || 'Unknown Grade'}
                  </Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator
                    style={styles.championTableScroll}
                    contentContainerStyle={styles.championTableContent}
                  >
                    <View style={styles.championTable}>
                      <View style={[styles.championTableRow, styles.championTableHeaderRow]}>
                        {championAverageColumns.map((column) => (
                          <View key={`header-${seasonRow.season ?? 'unknown'}-${column.key}`} style={[styles.championTableCell, styles.championTableHeaderCell]}>
                            <Text style={styles.championTableHeaderText}>{column.label}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.championTableRow}>
                        {championAverageColumns.map((column) => (
                          <View key={`value-${seasonRow.season ?? 'unknown'}-${column.key}`} style={styles.championTableCell}>
                            <Text style={styles.championTableValueText}>{formatChampionValue(seasonRow.averages[column.key], column.key)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </ScrollView>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>National Championships Stats - Season Averages</Text>
          <Text style={styles.statsAverageNote}>(All statistics shown are averages per game)</Text>
          {natChampSeasonAverages.length === 0 || natChampAverageColumns.length === 0 ? (
            <Text style={styles.statsSubtitle}>No National Championships season averages imported for this player yet.</Text>
          ) : (
            <View style={styles.championSeasonTableWrap}>
              {natChampSeasonAverages.map((seasonRow) => (
                <View key={`nc-season-${seasonRow.season ?? 'unknown'}-${seasonRow.grade ?? 'unknown'}`} style={styles.championSeasonCard}>
                  <Text style={[styles.championSeasonHeading, { color: '#F59E0B' }]}>
                    {seasonRow.season ?? 'Unknown'} - {seasonRow.gradeDisplayName || 'National Championships'}
                  </Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator
                    style={styles.championTableScroll}
                    contentContainerStyle={styles.championTableContent}
                  >
                    <View style={styles.championTable}>
                      <View style={[styles.championTableRow, styles.championTableHeaderRow]}>
                        {natChampAverageColumns.map((column) => (
                          <View key={`nc-header-${seasonRow.season ?? 'unknown'}-${column.key}`} style={[styles.championTableCell, styles.championTableHeaderCell]}>
                            <Text style={styles.championTableHeaderText}>{column.label}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.championTableRow}>
                        {natChampAverageColumns.map((column) => (
                          <View key={`nc-value-${seasonRow.season ?? 'unknown'}-${column.key}`} style={styles.championTableCell}>
                            <Text style={styles.championTableValueText}>{formatChampionValue(seasonRow.averages[column.key], column.key)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </ScrollView>
                </View>
              ))}
            </View>
          )}
        </Card>

        <PositionalAnalysis playerId={String(id ?? '')} isAdmin={!!isAdmin} />

        <AflPlayerComparison
          playerId={String(id ?? '')}
          playerName={player?.fullName ?? ''}
          isAdmin={!!isAdmin}
        />

        <GradientButton title="+ Add Report for this Player" onPress={() => router.push(`/report/new?playerId=${id}`)} style={{ marginBottom: 16 }} />

        <Text style={styles.sectionTitle}>Reports ({reports.length})</Text>
        {reports.length === 0 && <EmptyState icon="document-text-outline" message="No reports yet" />}
        {reports.map((r: any) => {
          const viewingMethodMeta = getViewingMethodMeta(r.viewingMethod);

          return (
            <Card key={r.id} onPress={() => router.push(`/report/${r.id}/edit`)} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.meta}>vs {r.opponent} • {new Date(r.matchDate).toLocaleDateString()}</Text>
                  <Text style={styles.meta}>{r.scoutName} • {r.primaryPosition}</Text>
                  {(r as any).representingTeam && (r as any).representingTeam !== player?.team && (
                    <Text style={[styles.meta, { color: '#10B981' }]}>🏟️ Representing: {(r as any).representingTeam}</Text>
                  )}
                  <View style={[styles.viewingBadge, { backgroundColor: `${viewingMethodMeta.color}22`, borderColor: `${viewingMethodMeta.color}66` }]}>
                    <Text style={styles.viewingBadgeEmoji}>{viewingMethodMeta.icon}</Text>
                    <Text style={[styles.viewingBadgeText, { color: viewingMethodMeta.color }]}>{viewingMethodMeta.label}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <ProjectionBadge value={r.overallProjection} />
                  <TouchableOpacity
                    style={styles.reportDownloadBtn}
                    activeOpacity={0.7}
                    disabled={downloadingReportId === r.id}
                    onPress={async () => {
                      setDownloadingReportId(r.id);
                      await downloadReportPdf(r.id);
                      setDownloadingReportId(null);
                    }}
                  >
                    {downloadingReportId === r.id ? (
                      <ActivityIndicator size="small" color={Colors.accent} />
                    ) : (
                      <Ionicons name="download-outline" size={18} color={Colors.accent} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              {GAME_STAT_KEYS.some(([key]) => (r as any)[key] != null) && (
                <View style={styles.reportStatsRow}>
                  {GAME_STAT_KEYS.filter(([key]) => (r as any)[key] != null).map(([key, label]) => (
                    <Text key={key} style={styles.reportStatChip}>{label}: {(r as any)[key]}</Text>
                  ))}
                </View>
              )}
            </Card>
          );
        })}

        {/* ═══════════ CONTACT HISTORY SECTION ═══════════ */}
        <View style={styles.meetingsSectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              Contact History ({contactLog.length})
            </Text>
          </View>
          {isContactAllowed(player.contactPermission) ? (
            <TouchableOpacity style={styles.addMeetingBtn} onPress={openAddContact} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={styles.addMeetingBtnText}>Log Contact</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.addMeetingBtnDisabled}>
              <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
              <Text style={styles.addMeetingBtnDisabledText}>Log Contact</Text>
            </View>
          )}
        </View>

        {!isContactAllowed(player.contactPermission) && (
          <View style={styles.contactBlockedBanner}>
            <Ionicons name="alert-circle" size={16} color={Colors.error} />
            <Text style={styles.contactBlockedText}>
              Logging a contact is disabled because agent contact is not allowed for this player.
              Record agent contact permission as “Agent contact allowed” above before approaching.
            </Text>
          </View>
        )}

        {contactLog.length === 0 && (
          <EmptyState icon="calendar-outline" message="No contact recorded" />
        )}

        {contactLog.map((entry) => {
          // Auto-generated stage-change entries render as compact read-only chips.
          if (entry.stageAfter != null) {
            return (
              <View key={entry.id} style={styles.stageChangeRow}>
                <Ionicons name="git-branch-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.stageChangeText} numberOfLines={2}>
                  {entry.note}
                </Text>
                <Text style={styles.stageChangeDate}>{formatDateAU(entry.occurredAt)}</Text>
              </View>
            );
          }

          // Manual / meeting-style entries render as full cards with edit/delete.
          const type = (entry.contactType as ContactType) || 'OTHER';
          return (
            <Card key={entry.id} style={{ marginBottom: 10 }}>
              {/* Header */}
              <View style={styles.meetingHeader}>
                <View style={[styles.meetingTypeBadge, { backgroundColor: `${CONTACT_TYPE_COLORS[type]}20` }]}>
                  <Ionicons
                    name={CONTACT_TYPE_ICONS[type] as any}
                    size={14}
                    color={CONTACT_TYPE_COLORS[type]}
                  />
                  <Text style={[styles.meetingTypeBadgeText, { color: CONTACT_TYPE_COLORS[type] }]}>
                    {CONTACT_TYPE_LABELS[type]}
                  </Text>
                </View>
                <Text style={styles.meetingDate}>{formatDateAU(entry.occurredAt)}</Text>
              </View>

              {/* Notes preview */}
              <Text style={styles.meetingNotes} numberOfLines={3}>
                {entry.note}
              </Text>

              {/* Meta info */}
              <View style={styles.meetingMetaRow}>
                {entry.attendees && (
                  <View style={styles.meetingMetaItem}>
                    <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.meetingMetaText}>{entry.attendees}</Text>
                  </View>
                )}
                {entry.location && (
                  <View style={styles.meetingMetaItem}>
                    <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.meetingMetaText}>{entry.location}</Text>
                  </View>
                )}
              </View>

              {entry.actionItems && (
                <View style={styles.actionItemsBox}>
                  <Text style={styles.actionItemsLabel}>Action Items</Text>
                  <Text style={styles.actionItemsText}>{entry.actionItems}</Text>
                </View>
              )}

              {/* Edit / Delete */}
              <View style={styles.meetingActions}>
                <TouchableOpacity
                  style={styles.meetingActionBtn}
                  onPress={() => handleEditContact(entry)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={16} color={Colors.accent} />
                  <Text style={[styles.meetingActionText, { color: Colors.accent }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.meetingActionBtn}
                  onPress={() => handleDeleteContact(entry)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  <Text style={[styles.meetingActionText, { color: Colors.error }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        })}

        {/* Return to Main Menu */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/dashboard')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Contact Form Modal */}
      <ContactForm
        visible={contactFormVisible}
        entry={editingEntry}
        onSave={handleSaveContact}
        onClose={() => { setContactFormVisible(false); setEditingEntry(null); }}
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
  profileTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  playerPhoto: { width: 72, height: 96, borderRadius: 10, backgroundColor: Colors.elevated },
  playerPhotoPlaceholder: { width: 72, height: 96, borderRadius: 10, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center' },
  fetchPhotoBtn: { position: 'absolute', bottom: -4, right: -4, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1 },
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
  watchListBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
  },
  watchListBtnActive: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.orange,
    borderRadius: 10,
    paddingVertical: 10,
  },
  watchListBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  name: { fontSize: 22, fontWeight: '800', color: Colors.text },
  permissionBadgeRow: { marginTop: 8, marginBottom: 2 },
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
  ratingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overallRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  overallRatingLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  overallRatingValue: { fontSize: 15, fontWeight: '800', color: Colors.accent },
  ratingGroupTitle: { fontSize: 14, fontWeight: '800', color: Colors.accent, letterSpacing: 1, marginBottom: 10, marginTop: 4, textTransform: 'uppercase' },
  ratingDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  statsSubtitle: { fontSize: 13, color: Colors.textMuted, marginBottom: 12 },
  statsAverageNote: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic', marginTop: -8, marginBottom: 12 },
  reportDownloadBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border },
  reportStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  reportStatChip: { fontSize: 11, color: Colors.accent, backgroundColor: Colors.elevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: '600', overflow: 'hidden' },
  viewingBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewingBadgeEmoji: {
    fontSize: 12,
  },
  viewingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  championSeasonTableWrap: {
    gap: 12,
  },
  championSeasonCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.elevated,
  },
  championSeasonHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  championTableScroll: {
    width: '100%',
  },
  championTableContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  championTable: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  championTableRow: {
    flexDirection: 'row',
    backgroundColor: Colors.elevated,
  },
  championTableHeaderRow: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  championTableCell: {
    minWidth: 96,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    justifyContent: 'center',
  },
  championTableHeaderCell: {
    minHeight: 46,
  },
  championTableHeaderText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  championTableValueText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
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

  // ── Contact history: stage-change chips ──
  stageChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.elevated,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.textMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  stageChangeText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  stageChangeDate: {
    color: Colors.textMuted,
    fontSize: 11,
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
  addMeetingBtnDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    opacity: 0.7,
  },
  addMeetingBtnDisabledText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  contactBlockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  contactBlockedText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
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