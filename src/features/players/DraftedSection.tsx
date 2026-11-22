import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import { Colors } from '../../theme/colors';
import { Player, AFL_CLUBS } from '../../types';
import { api } from '../../api/client';

/**
 * Drafted section on the player profile.
 *
 * Shows whether the player has been drafted and, if so, which AFL club, the
 * overall pick number and the draft date. For ADMIN / SCOUT users it opens an
 * editor (bottom sheet) to mark the player as drafted (club required), record
 * the pick and date, or reverse the decision.
 *
 * Marking a player as drafted automatically hides them from the watch-list
 * boards on the backend; their profile and history are always preserved, and
 * un-marking brings them back onto the boards.
 */

const TEAL = '#14B8A6'; // distinct "drafted" colour (not reused by any existing status badge)

function formatDateAU(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function todayAU(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function validateDateInput(value: string): string | null {
  if (!value.trim()) return null; // optional — backend defaults to today
  const formatRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!formatRegex.test(value)) return 'Use DD/MM/YYYY';
  const [dd, mm, yyyy] = value.split('/').map(Number);
  if (mm < 1 || mm > 12) return 'Invalid month';
  if (dd < 1 || dd > 31) return 'Invalid day';
  const dateObj = new Date(yyyy, mm - 1, dd);
  if (dateObj.getFullYear() !== yyyy || dateObj.getMonth() !== mm - 1 || dateObj.getDate() !== dd) {
    return 'Invalid date';
  }
  return null;
}

function parseDateToISO(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const [dd, mm, yyyy] = value.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

export default function DraftedSection({
  player,
  playerId,
  canManage,
  onUpdated,
}: {
  player: Player;
  playerId: string;
  canManage: boolean;
  onUpdated: () => Promise<void>;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [clubPickerOpen, setClubPickerOpen] = useState(false);

  // Editor local state
  const [isDrafted, setIsDrafted] = useState<boolean>(!!player.drafted);
  const [club, setClub] = useState<string>(player.draftedClub || '');
  const [pick, setPick] = useState<string>(player.draftedPick != null ? String(player.draftedPick) : '');
  const [draftType, setDraftType] = useState<string>(player.draftedType || '');
  const [dateStr, setDateStr] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const openEditor = () => {
    setIsDrafted(!!player.drafted);
    setClub(player.draftedClub || '');
    setPick(player.draftedPick != null ? String(player.draftedPick) : '');
    setDraftType(player.draftedType || '');
    setDateStr(player.draftedAt ? formatDateAU(player.draftedAt) : todayAU());
    setError(null);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    setError(null);
    if (isDrafted && !club) {
      setError('Please choose the AFL club that drafted this player.');
      return;
    }
    const dateErr = validateDateInput(dateStr);
    if (isDrafted && dateErr) {
      setError(dateErr);
      return;
    }
    let pickNum: number | undefined;
    if (isDrafted && pick.trim()) {
      pickNum = Number(pick.trim());
      if (!Number.isFinite(pickNum) || pickNum < 1) {
        setError('Pick number must be a whole number of 1 or more.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any = { drafted: isDrafted };
      if (isDrafted) {
        payload.draftedClub = club;
        if (pickNum != null) payload.draftedPick = pickNum;
        if (draftType.trim()) payload.draftedType = draftType.trim();
        const iso = parseDateToISO(dateStr);
        if (iso) payload.draftedAt = iso;
      }
      await api.patch(`/api/players/${playerId}/draft`, payload);
      await onUpdated();
      setEditorOpen(false);
      setMessage({
        type: 'success',
        text: isDrafted ? 'Player marked as drafted' : 'Draft status removed',
      });
      setTimeout(() => setMessage(null), 4000);
    } catch (e: any) {
      setError(e?.message || 'Failed to save draft status');
    } finally {
      setSaving(false);
    }
  };

  const drafted = !!player.drafted;

  return (
    <Card style={{ marginBottom: 16 }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="trophy-outline" size={18} color={drafted ? TEAL : Colors.accent} />
          <Text style={styles.sectionHeading}>Draft</Text>
        </View>
        {canManage && (
          <TouchableOpacity style={styles.editBtn} onPress={openEditor} activeOpacity={0.7}>
            <Ionicons name={drafted ? 'pencil' : 'add-circle-outline'} size={14} color={Colors.accent} />
            <Text style={styles.editBtnText}>{drafted ? 'Edit' : 'Mark as drafted'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Success/error message */}
      {message && (
        <View style={[styles.messageBanner, message.type === 'success' ? styles.messageSuccess : styles.messageError]}>
          <Ionicons name={message.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={14} color="#fff" />
          <Text style={styles.messageText}>{message.text}</Text>
        </View>
      )}

      {drafted ? (
        <View>
          <View style={styles.draftedBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.draftedBannerText}>
              Drafted{player.draftedClub ? ` — ${player.draftedClub}` : ''}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Club</Text>
              <Text style={styles.detailValue}>{player.draftedClub || '—'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Taken in</Text>
              <Text style={styles.detailValue}>{player.draftedType || '—'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Pick</Text>
              <Text style={styles.detailValue}>{player.draftedPick != null ? `#${player.draftedPick}` : '—'}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{formatDateAU(player.draftedAt)}</Text>
            </View>
          </View>
          <View style={styles.infoNote}>
            <Ionicons name="eye-off-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.infoNoteText}>
              Drafted players are automatically hidden from the watch list boards. Their profile and history are kept.
            </Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity activeOpacity={canManage ? 0.6 : 1} onPress={canManage ? openEditor : undefined} disabled={!canManage}>
          <Text style={styles.placeholder}>
            {canManage ? 'Not drafted yet. Tap “Mark as drafted” to record which club selected this player.' : 'Not drafted yet.'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ─────── Editor bottom sheet ─────── */}
      <Modal visible={editorOpen} transparent animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setEditorOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.handleBar} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Draft status</Text>
              <TouchableOpacity onPress={() => setEditorOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetPlayerName} numberOfLines={1}>
              {player.fullName}
            </Text>

            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {/* Drafted? segmented toggle */}
              <Text style={styles.fieldLabel}>Has this player been drafted?</Text>
              <View style={styles.segment}>
                <TouchableOpacity
                  style={[styles.segmentBtn, !isDrafted && styles.segmentBtnActive]}
                  onPress={() => setIsDrafted(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentText, !isDrafted && styles.segmentTextActive]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, isDrafted && styles.segmentBtnActiveYes]}
                  onPress={() => setIsDrafted(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentText, isDrafted && styles.segmentTextActive]}>Yes</Text>
                </TouchableOpacity>
              </View>

              {isDrafted && (
                <>
                  {/* Club picker */}
                  <Text style={styles.fieldLabel}>Drafting club *</Text>
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => setClubPickerOpen(true)} activeOpacity={0.7}>
                    <Ionicons name="shield-outline" size={16} color={club ? Colors.text : Colors.textMuted} />
                    <Text style={[styles.pickerBtnText, !club && { color: Colors.textMuted }]}>
                      {club || 'Choose AFL club'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
                  </TouchableOpacity>

                  {/* How taken (free text) */}
                  <Text style={styles.fieldLabel}>Taken in (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={draftType}
                    onChangeText={setDraftType}
                    placeholder="e.g. Main draft, Rookie, Cat B, SSP, Mid season"
                    placeholderTextColor={Colors.textMuted}
                    maxLength={100}
                  />

                  {/* Pick number */}
                  <Text style={styles.fieldLabel}>Pick number (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={pick}
                    onChangeText={(t) => setPick(t.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 12"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    maxLength={3}
                  />

                  {/* Draft date */}
                  <Text style={styles.fieldLabel}>Draft date (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={dateStr}
                    onChangeText={setDateStr}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </>
              )}

              {!isDrafted && (
                <View style={styles.infoNote}>
                  <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.infoNoteText}>
                    Saving with “No” clears any draft details and returns the player to the watch list boards.
                  </Text>
                </View>
              )}

              {error && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={14} color="#fff" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─────── Club picker modal ─────── */}
      <Modal visible={clubPickerOpen} transparent animationType="slide" onRequestClose={() => setClubPickerOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setClubPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.handleBar} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Choose AFL club</Text>
              <TouchableOpacity onPress={() => setClubPickerOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
              {AFL_CLUBS.map((c) => {
                const active = c === club;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.clubRow, active && styles.clubRowActive]}
                    onPress={() => {
                      setClub(c);
                      setClubPickerOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.clubRowText, active && styles.clubRowTextActive]}>{c}</Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={TEAL} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeading: { fontSize: 16, fontWeight: '700', color: Colors.text },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceHigh,
  },
  editBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '600' },

  draftedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TEAL,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  draftedBannerText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  detailRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 10, marginBottom: 12 },
  detailItem: { gap: 2 },
  detailLabel: { color: Colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { color: Colors.text, fontSize: 15, fontWeight: '600' },

  infoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
  infoNoteText: { color: Colors.textMuted, fontSize: 12, flex: 1, lineHeight: 17 },

  placeholder: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },

  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  messageSuccess: { backgroundColor: Colors.green },
  messageError: { backgroundColor: Colors.error },
  messageText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },

  // Sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  sheetPlayerName: { color: Colors.textSecondary, fontSize: 14, marginTop: 2, marginBottom: 12 },

  fieldLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 14, marginBottom: 6 },

  segment: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentBtnActive: { backgroundColor: Colors.elevated, borderColor: Colors.accent },
  segmentBtnActiveYes: { backgroundColor: TEAL, borderColor: TEAL },
  segmentText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  segmentTextActive: { color: '#fff' },

  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerBtnText: { flex: 1, color: Colors.text, fontSize: 15, fontWeight: '600' },

  input: {
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.error,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 14,
  },
  errorText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 18,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  clubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: Colors.surfaceHigh,
  },
  clubRowActive: { borderWidth: 1, borderColor: TEAL },
  clubRowText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  clubRowTextActive: { color: TEAL },
});
