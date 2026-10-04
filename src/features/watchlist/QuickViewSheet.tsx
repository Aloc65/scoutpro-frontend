import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../api/client';
import { AFL_TEAMS } from '../../constants/aflTeams';
import { Colors } from '../../theme/colors';
import { showAlert } from '../../utils/alert';
import {
  ContactLogEntry,
  PIPELINE_STAGES,
  PipelineStage,
  WatchList,
  isContactAllowed,
  isPlayerSigned,
  CONTACT_PERMISSION_LABELS,
} from '../../types';
import {
  STAGE_CONFIG,
  draftYearOf,
  formatContactDate,
  hasActiveAflInterest,
  isStale,
  lastContactLabel,
} from './pipeline';
import ContactPermissionBadge from '../../components/ContactPermissionBadge';
import PriorityBadge from '../../components/PriorityBadge';
import { updatePriority as apiUpdatePriority } from '../../api/watchList';

// Stages whose purpose is to initiate / progress direct contact with the player
// or their family. Moving INTO one of these while permission is not ALLOWED must
// surface a prominent warning (but never block the move).
const CONTACT_STAGES: PipelineStage[] = ['INITIAL_CALL', 'FAMILY_MEETING', 'OFFER_MADE'];

// Inline priority tier choices (incl. the explicit "Not set" = null).
const PRIORITY_CHOICES: { value: number | null; label: string }[] = [
  { value: 1, label: 'High' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Monitor' },
  { value: 4, label: 'Hold' },
  { value: null, label: 'Not set' },
];

interface Props {
  visible: boolean;
  entry: WatchList | null;
  onClose: () => void;
  // Called with the updated entry whenever stage / AFL interest changes so the
  // parent can update its lists without a full refresh.
  onEntryChanged: (updated: WatchList) => void;
}

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function QuickViewSheet({ visible, entry, onClose, onEntryChanged }: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<WatchList | null>(entry);
  const [log, setLog] = useState<ContactLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Pending stage change (awaiting optional note confirmation).
  const [pendingStage, setPendingStage] = useState<PipelineStage | null>(null);
  const [stageNote, setStageNote] = useState('');
  const [savingStage, setSavingStage] = useState(false);

  // Log-contact composer.
  const [logOpen, setLogOpen] = useState(false);
  const [logNote, setLogNote] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  // AFL interest editor.
  const [aflOpen, setAflOpen] = useState(false);
  const [savingAfl, setSavingAfl] = useState(false);

  // Priority editor.
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);

  const playerId = entry?.playerId ?? null;

  const loadDetail = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    try {
      const [entryRes, logRes] = await Promise.all([
        api.get<{ inWatchList: boolean; entry: WatchList | null }>(`/api/watch-list/player/${playerId}`),
        api.get<{ items: ContactLogEntry[] }>(`/api/players/${playerId}/contact-log`),
      ]);
      if (entryRes.entry) setDetail(entryRes.entry);
      setLog(logRes.items || []);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to load player details');
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    if (visible && entry) {
      setDetail(entry);
      setPendingStage(null);
      setStageNote('');
      setLogOpen(false);
      setLogNote('');
      setAflOpen(false);
      setPriorityOpen(false);
      loadDetail();
    }
  }, [visible, entry, loadDetail]);

  const current = detail || entry;
  if (!current) return null;

  const player = current.player;
  const dy = draftYearOf(current);

  const confirmStageChange = async () => {
    if (!pendingStage || !playerId) return;
    setSavingStage(true);
    try {
      const updated = await api.patch<WatchList>(`/api/watch-list/${playerId}/stage`, {
        stage: pendingStage,
        note: stageNote.trim() || undefined,
      });
      setDetail(updated);
      onEntryChanged(updated);
      setPendingStage(null);
      setStageNote('');
      await loadDetail();
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to change stage');
    } finally {
      setSavingStage(false);
    }
  };

  const submitLog = async () => {
    if (!logNote.trim() || !playerId) return;
    setSavingLog(true);
    try {
      await api.post(`/api/players/${playerId}/contact-log`, {
        occurredAt: new Date().toISOString(),
        note: logNote.trim(),
      });
      setLogNote('');
      setLogOpen(false);
      await loadDetail();
      // Refresh parent's lastContactAt by re-fetching the entry.
      const entryRes = await api.get<{ entry: WatchList | null }>(`/api/watch-list/player/${playerId}`);
      if (entryRes.entry) onEntryChanged(entryRes.entry);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to log contact');
    } finally {
      setSavingLog(false);
    }
  };

  const setAflInterest = async (club: string) => {
    if (!playerId) return;
    setSavingAfl(true);
    try {
      const updated = await api.patch<WatchList>(`/api/watch-list/${playerId}/afl-interest`, { club });
      setDetail(updated);
      onEntryChanged(updated);
      setAflOpen(false);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to update AFL interest');
    } finally {
      setSavingAfl(false);
    }
  };

  const setPriority = async (value: number | null) => {
    if (!playerId) return;
    setSavingPriority(true);
    try {
      const updated = await apiUpdatePriority(playerId, value, current.priorityReason ?? null);
      setDetail(updated);
      onEntryChanged(updated);
      setPriorityOpen(false);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to update priority');
    } finally {
      setSavingPriority(false);
    }
  };

  const goToProfile = () => {
    onClose();
    router.push(`/player/${current.playerId}` as any);
  };
  const goToAddReport = () => {
    onClose();
    router.push(`/report/new?playerId=${current.playerId}` as any);
  };

  const showAflBanner = hasActiveAflInterest(current) || !!current.aflInterestClub;
  const permissionValue = player?.contactPermission ?? 'NOT_RECORDED';
  const signed = isPlayerSigned(current) || isPlayerSigned(player as any);
  // Signed players are committed: approach stays off, notices are hidden.
  const permissionAllowed = !signed && isContactAllowed(permissionValue);
  // Warn when moving into a contact-initiating stage without permission.
  const stageWarn = !!pendingStage && CONTACT_STAGES.includes(pendingStage) && !permissionAllowed && !signed;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(player?.fullName || '')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{player?.fullName || '—'}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {[player?.team, player?.state, dy ? `Draft ${dy}` : null, current.primaryPosition]
                  .filter(Boolean)
                  .join('  ·  ') || '—'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {/* Agent-contact permission — most prominent indicator, shown first */}
            {!signed && (
            <View style={styles.permissionRow}>
              <ContactPermissionBadge permission={permissionValue} size="lg" />
              {player?.contactConfirmedAt ? (
                <Text style={styles.permissionMeta}>
                  Confirmed {formatContactDate(player.contactConfirmedAt)}
                </Text>
              ) : null}
            </View>
            )}

            {/* AFL interest banner */}
            {showAflBanner ? (
              <TouchableOpacity style={styles.aflBanner} onPress={() => setAflOpen((v) => !v)} activeOpacity={0.8}>
                <Ionicons name="flame" size={18} color={Colors.orange} />
                <Text style={styles.aflBannerText}>
                  AFL interest: <Text style={{ fontWeight: '800' }}>{current.aflInterestClub}</Text>
                </Text>
                <Ionicons name="pencil" size={14} color={Colors.textMuted} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.aflAdd} onPress={() => setAflOpen((v) => !v)} activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={16} color={Colors.accent} />
                <Text style={styles.aflAddText}>Add AFL club interest</Text>
              </TouchableOpacity>
            )}

            {aflOpen && (
              <View style={styles.aflPicker}>
                <View style={styles.aflChipsWrap}>
                  {current.aflInterestClub ? (
                    <TouchableOpacity
                      style={[styles.aflChip, styles.aflChipClear]}
                      onPress={() => setAflInterest('')}
                      disabled={savingAfl}
                    >
                      <Ionicons name="close" size={12} color={Colors.error} />
                      <Text style={[styles.aflChipText, { color: Colors.error }]}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                  {AFL_TEAMS.map((team) => {
                    const selected = current.aflInterestClub === team;
                    return (
                      <TouchableOpacity
                        key={team}
                        style={[styles.aflChip, selected && styles.aflChipSelected]}
                        onPress={() => setAflInterest(team)}
                        disabled={savingAfl}
                      >
                        <Text style={[styles.aflChipText, selected && { color: '#fff' }]}>{team}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Stage selector */}
            <Text style={styles.sectionLabel}>Pipeline Stage</Text>
            <View style={styles.stageRow}>
              {PIPELINE_STAGES.map((stage) => {
                const cfg = STAGE_CONFIG[stage];
                const active = current.stage === stage;
                return (
                  <TouchableOpacity
                    key={stage}
                    style={[styles.stagePill, active && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                    onPress={() => {
                      if (stage === current.stage) return;
                      setPendingStage(stage);
                      setStageNote('');
                    }}
                  >
                    <Text style={[styles.stagePillText, active && { color: '#fff' }]} numberOfLines={2}>
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pending stage-change note composer */}
            {pendingStage && (
              <View style={styles.noteComposer}>
                <Text style={styles.noteComposerTitle}>
                  Move to {STAGE_CONFIG[pendingStage].label}
                </Text>
                {stageWarn && (
                  <View style={styles.stageWarn}>
                    <Ionicons name="warning" size={16} color={Colors.error} />
                    <Text style={styles.stageWarnText}>
                      Agent contact is not confirmed for this player
                      ({CONTACT_PERMISSION_LABELS[permissionValue]}). Moving to this stage does not
                      grant permission — do not approach the player or their family until permission
                      is recorded as allowed.
                    </Text>
                  </View>
                )}
                <TextInput
                  value={stageNote}
                  onChangeText={setStageNote}
                  placeholder="Add an optional note (logged to contact history)"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.noteInput}
                  multiline
                />
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={() => setPendingStage(null)} style={styles.noteCancel}>
                    <Text style={styles.noteCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmStageChange} style={styles.noteConfirm} disabled={savingStage}>
                    {savingStage ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.noteConfirmText}>Confirm</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Priority tier (per-watchlist-entry; inline-editable) */}
            <View style={styles.historyHeader}>
              <Text style={styles.sectionLabel}>Priority</Text>
              <TouchableOpacity style={styles.logBtn} onPress={() => setPriorityOpen((v) => !v)}>
                <Ionicons name="pencil" size={14} color={Colors.accent} />
                <Text style={styles.logBtnText}>{priorityOpen ? 'Close' : 'Edit'}</Text>
              </TouchableOpacity>
            </View>
            {!priorityOpen ? (
              <View style={styles.priorityDisplay}>
                <PriorityBadge priority={current.priority ?? null} />
                {current.priorityReason ? (
                  <Text style={styles.priorityReason} numberOfLines={2}>{current.priorityReason}</Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.priorityChoices}>
                {PRIORITY_CHOICES.map((opt) => {
                  const active = (current.priority ?? null) === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[styles.priorityChoice, active && styles.priorityChoiceActive]}
                      onPress={() => setPriority(opt.value)}
                      disabled={savingPriority}
                    >
                      <PriorityBadge priority={opt.value} compact />
                    </TouchableOpacity>
                  );
                })}
                {savingPriority && <ActivityIndicator size="small" color={Colors.accent} />}
              </View>
            )}

            {/* Metrics */}
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{current.priorityRank ?? '—'}</Text>
                <Text style={styles.metricLabel}>Priority Rank</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{current.reportCount ?? '—'}</Text>
                <Text style={styles.metricLabel}>Reports</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>
                  {current.avgRating != null ? current.avgRating.toFixed(1) : '—'}
                </Text>
                <Text style={styles.metricLabel}>
                  {current.avgRating != null ? 'Overall / 5' : 'Not rated'}
                </Text>
              </View>
            </View>

            {/* Contact history */}
            <View style={styles.historyHeader}>
              <Text style={styles.sectionLabel}>Contact History</Text>
              {permissionAllowed ? (
                <TouchableOpacity style={styles.logBtn} onPress={() => setLogOpen((v) => !v)}>
                  <Ionicons name="add" size={16} color={Colors.accent} />
                  <Text style={styles.logBtnText}>Log contact</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.logBtnDisabled}>
                  <Ionicons name="lock-closed" size={14} color={Colors.textMuted} />
                  <Text style={styles.logBtnDisabledText}>Log contact</Text>
                </View>
              )}
            </View>

            {!permissionAllowed && !signed && (
              <View style={styles.contactBlocked}>
                <Ionicons name="hand-left" size={15} color={Colors.error} />
                <Text style={styles.contactBlockedText}>
                  Logging contact is disabled — agent contact is not allowed for this player
                  ({CONTACT_PERMISSION_LABELS[permissionValue]}). Record permission as allowed on the
                  player profile before approaching.
                </Text>
              </View>
            )}

            {permissionAllowed && logOpen && (
              <View style={styles.noteComposer}>
                <TextInput
                  value={logNote}
                  onChangeText={setLogNote}
                  placeholder="What happened? (e.g. Spoke with player's manager)"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.noteInput}
                  multiline
                />
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={() => { setLogOpen(false); setLogNote(''); }} style={styles.noteCancel}>
                    <Text style={styles.noteCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={submitLog} style={styles.noteConfirm} disabled={savingLog || !logNote.trim()}>
                    {savingLog ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.noteConfirmText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {loading ? (
              <ActivityIndicator size="small" color={Colors.accent} style={{ marginVertical: 16 }} />
            ) : log.length === 0 ? (
              <Text style={styles.emptyLog}>No contact logged yet.</Text>
            ) : (
              log.map((e) => (
                <View key={e.id} style={styles.logEntry}>
                  <View style={styles.logDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logNoteText}>{e.note}</Text>
                    <Text style={styles.logMeta}>
                      {formatContactDate(e.occurredAt)}
                      {e.user?.name ? `  ·  ${e.user.name}` : ''}
                      {e.stageAfter ? `  ·  → ${STAGE_CONFIG[e.stageAfter].label}` : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}

            {/* Last-contact recency chip */}
            <View style={[styles.recencyChip, isStale(current.lastContactAt) && styles.recencyStale]}>
              <Ionicons
                name="time-outline"
                size={13}
                color={isStale(current.lastContactAt) ? Colors.amber : Colors.textMuted}
              />
              <Text
                style={[styles.recencyText, isStale(current.lastContactAt) && { color: Colors.amber }]}
              >
                Last contact: {lastContactLabel(current.lastContactAt)}
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionSecondary} onPress={goToProfile}>
              <Ionicons name="person-outline" size={18} color={Colors.text} />
              <Text style={styles.actionSecondaryText}>Full profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionPrimary} onPress={goToAddReport}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.actionPrimaryText}>Add report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    maxHeight: '90%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  name: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 4 },

  aflBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
  },
  aflBannerText: { color: Colors.text, fontSize: 13 },
  aflAdd: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 4 },
  aflAddText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  aflPicker: { marginBottom: 8 },
  aflChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aflChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border,
  },
  aflChipSelected: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  aflChipClear: { borderColor: 'rgba(239,68,68,0.5)' },
  aflChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },

  permissionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12,
  },
  permissionMeta: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  stageWarn: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)',
    borderRadius: 10, padding: 10, marginBottom: 10,
  },
  stageWarnText: { flex: 1, color: Colors.error, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  priorityDisplay: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  priorityReason: { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  priorityChoices: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  priorityChoice: {
    paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8,
    borderWidth: 1, borderColor: 'transparent',
  },
  priorityChoiceActive: { borderColor: Colors.accent, backgroundColor: Colors.elevated },
  logBtnDisabled: { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.6 },
  logBtnDisabledText: { color: Colors.textMuted, fontWeight: '700', fontSize: 13 },
  contactBlocked: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 10, padding: 10, marginTop: 4, marginBottom: 4,
  },
  contactBlockedText: { flex: 1, color: Colors.error, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  sectionLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  stageRow: { flexDirection: 'row', gap: 6 },
  stagePill: {
    flex: 1, minHeight: 46, borderRadius: 10, paddingHorizontal: 4, paddingVertical: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border,
  },
  stagePillText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' },

  noteComposer: {
    marginTop: 10, backgroundColor: Colors.elevated, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 12,
  },
  noteComposerTitle: { color: Colors.text, fontWeight: '700', marginBottom: 8 },
  noteInput: {
    color: Colors.text, backgroundColor: Colors.background, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, padding: 10, minHeight: 60, textAlignVertical: 'top',
  },
  noteActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  noteCancel: { paddingHorizontal: 14, paddingVertical: 9 },
  noteCancelText: { color: Colors.textSecondary, fontWeight: '600' },
  noteConfirm: {
    backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 9,
    minWidth: 84, alignItems: 'center',
  },
  noteConfirmText: { color: '#fff', fontWeight: '700' },

  metricsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  metric: {
    flex: 1, backgroundColor: Colors.elevated, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.border, paddingVertical: 14, alignItems: 'center',
  },
  metricValue: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  metricLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },

  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 13 },
  emptyLog: { color: Colors.textMuted, fontSize: 13, fontStyle: 'italic', marginVertical: 12 },
  logEntry: { flexDirection: 'row', gap: 10, paddingVertical: 8, alignItems: 'flex-start' },
  logDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent, marginTop: 5 },
  logNoteText: { color: Colors.text, fontSize: 13, lineHeight: 18 },
  logMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },

  recencyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginTop: 14, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Colors.elevated,
  },
  recencyStale: { backgroundColor: 'rgba(245,158,11,0.12)' },
  recencyText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.elevated, borderRadius: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: Colors.border,
  },
  actionSecondaryText: { color: Colors.text, fontWeight: '700' },
  actionPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13,
  },
  actionPrimaryText: { color: '#fff', fontWeight: '700' },
});
