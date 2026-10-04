import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import ContactPermissionBadge from '../../components/ContactPermissionBadge';
import { Colors } from '../../theme/colors';
import {
  Player,
  ContactPermission,
  CONTACT_PERMISSIONS,
  CONTACT_PERMISSION_LABELS,
  ContactPermissionAudit,
} from '../../types';
import {
  updateContactPermission,
  getContactPermissionHistory,
  UpdateContactPermissionPayload,
} from '../../api/watchList';

/**
 * Agent-contact-permission management section on the player profile.
 *
 * Shows the current (player-level) permission plus who recorded it and when,
 * and — for ADMIN / SCOUT — lets them record / update the preference together
 * with the date confirmed, source/reference and an optional note. Every change
 * is written with an audit row (retained on the backend) and the full history
 * is viewable here.
 *
 * Recording a value here is an administrative record of what the agent / club
 * has confirmed. It is NOT the scout granting permission on the player's
 * behalf — this is stated explicitly in the UI.
 */

const PERMISSION_OPTIONS: ContactPermission[] = [...CONTACT_PERMISSIONS];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Accepts DD/MM/YYYY and returns ISO (midnight local) or null if blank/invalid.
function parseAuDate(input: string): { iso: string | null; error: string | null } {
  const trimmed = input.trim();
  if (!trimmed) return { iso: null, error: null };
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return { iso: null, error: 'Use DD/MM/YYYY' };
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { iso: null, error: 'Invalid date' };
  }
  const d = new Date(year, month - 1, day, 0, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return { iso: null, error: 'Invalid date' };
  }
  return { iso: d.toISOString(), error: null };
}

export default function ContactPermissionSection({
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
  const current: ContactPermission = player.contactPermission ?? 'NOT_RECORDED';

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [selected, setSelected] = useState<ContactPermission>(current);
  const [confirmedAtInput, setConfirmedAtInput] = useState('');
  const [sourceInput, setSourceInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  // Audit history
  const [history, setHistory] = useState<ContactPermissionAudit[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await getContactPermissionHistory(playerId);
      setHistory(res.history || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const startEdit = () => {
    setSelected(current);
    setConfirmedAtInput(
      player.contactConfirmedAt
        ? formatDate(player.contactConfirmedAt).replace(/\s/g, ' ')
        : '',
    );
    // Prefill the raw DD/MM/YYYY form of the existing confirmed date.
    if (player.contactConfirmedAt) {
      const d = new Date(player.contactConfirmedAt);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        setConfirmedAtInput(`${dd}/${mm}/${d.getFullYear()}`);
      }
    } else {
      setConfirmedAtInput('');
    }
    setSourceInput(player.contactSource || '');
    setNoteInput('');
    setDateError(null);
    setMessage(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDateError(null);
    setMessage(null);
  };

  const save = async () => {
    const { iso, error } = parseAuDate(confirmedAtInput);
    if (error) {
      setDateError(error);
      return;
    }
    setDateError(null);
    setSaving(true);
    setMessage(null);

    const payload: UpdateContactPermissionPayload = {
      permission: selected,
      confirmedAt: iso,
      source: sourceInput.trim() || null,
      note: noteInput.trim() || null,
    };

    try {
      await updateContactPermission(playerId, payload);
      await onUpdated();
      await loadHistory();
      setEditing(false);
      setMessage({ type: 'success', text: 'Contact permission saved' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e: any) {
      // On failure keep the sheet open and leave the saved value unchanged.
      setMessage({ type: 'error', text: e?.message || 'Failed to save. Previous value kept.' });
      setTimeout(() => setMessage(null), 6000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.accent} />
          <Text style={styles.sectionHeading}>Agent Contact Permission</Text>
        </View>
        {canManage && !editing && (
          <TouchableOpacity style={styles.editBtn} onPress={startEdit} activeOpacity={0.7}>
            <Ionicons name="pencil" size={14} color={Colors.accent} />
            <Text style={styles.editBtnText}>Record / Update</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Message banner */}
      {message && (
        <View
          style={[
            styles.messageBanner,
            message.type === 'success' ? styles.messageSuccess : styles.messageError,
          ]}
        >
          <Ionicons
            name={message.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={14}
            color="#fff"
          />
          <Text style={styles.messageText}>{message.text}</Text>
        </View>
      )}

      {/* Current status (always visible) */}
      <View style={styles.currentRow}>
        <ContactPermissionBadge permission={current} size="lg" />
      </View>
      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Date confirmed</Text>
          <Text style={styles.metaValue}>{formatDate(player.contactConfirmedAt)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Source</Text>
          <Text style={styles.metaValue}>{player.contactSource || '—'}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Recorded by</Text>
          <Text style={styles.metaValue}>{player.contactRecordedByName || '—'}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Recorded at</Text>
          <Text style={styles.metaValue}>{formatDateTime(player.contactRecordedAt)}</Text>
        </View>
      </View>

      {/* Edit form */}
      {editing && (
        <View style={styles.form}>
          <Text style={styles.disclaimer}>
            Recording a value here is an administrative record of what the agent / club has
            confirmed. It is not the scout granting permission on the player's behalf.
          </Text>

          <Text style={styles.fieldLabel}>Permission</Text>
          <View style={styles.optionsCol}>
            {PERMISSION_OPTIONS.map((opt) => {
              const active = selected === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => setSelected(opt)}
                  activeOpacity={0.7}
                  disabled={saving}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={active ? Colors.accent : Colors.textMuted}
                  />
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {CONTACT_PERMISSION_LABELS[opt]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Date confirmed</Text>
          <TextInput
            style={[styles.input, dateError && styles.inputError]}
            value={confirmedAtInput}
            onChangeText={(t) => {
              setConfirmedAtInput(t);
              setDateError(null);
            }}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numeric"
            maxLength={10}
            editable={!saving}
          />
          {dateError && <Text style={styles.inlineError}>{dateError}</Text>}

          <Text style={styles.fieldLabel}>Source / reference</Text>
          <TextInput
            style={styles.input}
            value={sourceInput}
            onChangeText={setSourceInput}
            placeholder="e.g. agent name, email reference"
            placeholderTextColor={Colors.textMuted}
            maxLength={500}
            editable={!saving}
          />

          <Text style={styles.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={noteInput}
            onChangeText={setNoteInput}
            placeholder="Any context recorded with this change..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={2000}
            editable={!saving}
          />

          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={cancelEdit}
              activeOpacity={0.7}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={save}
              activeOpacity={0.7}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Audit history toggle */}
      <TouchableOpacity
        style={styles.historyToggle}
        onPress={() => setHistoryOpen((o) => !o)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={historyOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={Colors.textSecondary}
        />
        <Text style={styles.historyToggleText}>
          {historyOpen ? 'Hide' : 'Show'} change history
          {history.length ? ` (${history.length})` : ''}
        </Text>
      </TouchableOpacity>

      {historyOpen && (
        <View style={styles.historyList}>
          {historyLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} style={{ marginVertical: 8 }} />
          ) : history.length === 0 ? (
            <Text style={styles.historyEmpty}>No changes recorded yet.</Text>
          ) : (
            history.map((h) => (
              <View key={h.id} style={styles.historyRow}>
                <ContactPermissionBadge permission={h.permission} size="sm" full />
                <View style={styles.historyMeta}>
                  <Text style={styles.historyMetaText}>
                    Confirmed {formatDate(h.confirmedAt)}
                    {h.source ? ` · ${h.source}` : ''}
                  </Text>
                  <Text style={styles.historyMetaSub}>
                    By {h.recordedByName || '—'} · {formatDateTime(h.recordedAt)}
                  </Text>
                  {h.note ? <Text style={styles.historyNote}>{h.note}</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>
      )}
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
  sectionHeading: { fontSize: 18, fontWeight: '700', color: Colors.text },
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
  editBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  messageSuccess: { backgroundColor: 'rgba(34,197,94,0.2)' },
  messageError: { backgroundColor: 'rgba(239,68,68,0.2)' },
  messageText: { fontSize: 13, fontWeight: '600', color: '#fff', flex: 1 },
  currentRow: { marginBottom: 12 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { minWidth: 120, flexGrow: 1, flexBasis: '40%' },
  metaLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metaValue: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  form: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 14,
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 4,
  },
  optionsCol: { gap: 6, marginBottom: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.elevated,
  },
  optionRowActive: { borderColor: Colors.accent, backgroundColor: 'rgba(59,130,246,0.1)' },
  optionText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600', flex: 1 },
  optionTextActive: { color: Colors.text },
  input: {
    backgroundColor: Colors.elevated,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  inputError: { borderColor: Colors.error },
  inlineError: { color: Colors.error, fontSize: 12, marginTop: -4, marginBottom: 8 },
  textArea: { minHeight: 70, maxHeight: 160 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  historyToggleText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  historyList: { marginTop: 10, gap: 10 },
  historyEmpty: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' },
  historyRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    padding: 10,
  },
  historyMeta: { flex: 1 },
  historyMetaText: { fontSize: 13, color: Colors.text, fontWeight: '600', marginTop: 2 },
  historyMetaSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  historyNote: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
});
