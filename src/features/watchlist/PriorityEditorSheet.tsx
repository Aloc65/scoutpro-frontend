import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { WatchList } from '../../types';
import PriorityBadge from '../../components/PriorityBadge';

// Priority tier options, including the explicit "Not set" (null) choice.
const OPTIONS: { value: number | null; label: string }[] = [
  { value: 1, label: 'High' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Monitor' },
  { value: 4, label: 'Hold' },
  { value: null, label: 'Not set' },
];

/**
 * Inline priority editor (bottom sheet) used from both the Board and the Table.
 *
 * Sets the per-watchlist-entry priority tier (distinct from stage, overall
 * rating and agent-contact permission) plus an optional reason. On save the
 * parent persists the change and refetches so the entry repositions under the
 * priority-first ordering.
 */
export default function PriorityEditorSheet({
  visible,
  entry,
  onClose,
  onSave,
}: {
  visible: boolean;
  entry: WatchList | null;
  onClose: () => void;
  onSave: (playerId: string, priority: number | null, reason: string | null) => Promise<void>;
}) {
  const [priority, setPriority] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Re-sync local state whenever a new entry is opened.
  useEffect(() => {
    if (entry) {
      setPriority(entry.priority ?? null);
      setReason(entry.priorityReason ?? '');
    }
  }, [entry]);

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      await onSave(entry.playerId, priority, reason.trim() ? reason.trim() : null);
      onClose();
    } catch {
      // Parent shows the error and restores the previous value; keep sheet open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.handleBar} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Set priority</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.playerName} numberOfLines={1}>
            {entry?.player?.fullName || '—'}
          </Text>

          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>Priority tier</Text>
            <View style={styles.optionGrid}>
              {OPTIONS.map((opt) => {
                const active = priority === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => setPriority(opt.value)}
                  >
                    <PriorityBadge priority={opt.value} />
                    {active && <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Priority reason (optional)</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Why this priority? (optional)"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              multiline
              maxLength={500}
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save priority</Text>
            )}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  handleBar: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: Colors.text, fontWeight: '800', fontSize: 17 },
  playerName: { color: Colors.textSecondary, fontSize: 13, marginTop: 2, marginBottom: 12 },
  sectionLabel: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', marginTop: 8, marginBottom: 8,
  },
  optionGrid: { gap: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.elevated,
  },
  optionActive: { borderColor: Colors.accent },
  input: {
    color: Colors.text, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 12, minHeight: 60, textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: 16, backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.6 },
});
