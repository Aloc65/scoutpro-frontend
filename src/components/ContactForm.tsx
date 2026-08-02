import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, ScrollView,
  TouchableOpacity, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  ContactLogEntry,
  ContactType,
  CONTACT_TYPES,
  CONTACT_TYPE_LABELS,
} from '../types';
import DatePicker from './DatePicker';
import GradientButton from './GradientButton';
import { Ionicons } from '@expo/vector-icons';

export interface ContactFormData {
  occurredAt: string;
  note: string;
  contactType?: string | null;
  attendees?: string | null;
  location?: string | null;
  actionItems?: string | null;
}

interface Props {
  visible: boolean;
  entry?: ContactLogEntry | null;
  onSave: (data: ContactFormData) => Promise<void>;
  onClose: () => void;
}

/** Convert ISO date to YYYY-MM-DD for the DatePicker */
function formatDateForPicker(isoDate?: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

function todayYMD(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function ContactForm({ visible, entry, onSave, onClose }: Props) {
  const [occurredAt, setOccurredAt] = useState('');
  const [contactType, setContactType] = useState<ContactType>('INITIAL');
  const [note, setNote] = useState('');
  const [attendees, setAttendees] = useState('');
  const [location, setLocation] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  useEffect(() => {
    if (entry) {
      setOccurredAt(formatDateForPicker(entry.occurredAt));
      setContactType((entry.contactType as ContactType) || 'INITIAL');
      setNote(entry.note || '');
      setAttendees(entry.attendees || '');
      setLocation(entry.location || '');
      setActionItems(entry.actionItems || '');
    } else {
      setOccurredAt(todayYMD());
      setContactType('INITIAL');
      setNote('');
      setAttendees('');
      setLocation('');
      setActionItems('');
    }
    setError('');
    setShowTypeDropdown(false);
  }, [entry, visible]);

  const handleSave = async () => {
    if (!occurredAt.trim()) {
      setError('Date is required');
      return;
    }
    if (!note.trim()) {
      setError('Notes are required');
      return;
    }

    // occurredAt is YYYY-MM-DD from DatePicker
    const isoDate = `${occurredAt}T00:00:00.000Z`;

    setSaving(true);
    setError('');
    try {
      await onSave({
        occurredAt: isoDate,
        note: note.trim(),
        contactType,
        attendees: attendees.trim() || null,
        location: location.trim() || null,
        actionItems: actionItems.trim() || null,
      });
    } catch (e: any) {
      setError(e.message || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {entry ? 'Edit Contact' : 'Log Contact'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Date Picker */}
            <DatePicker label="Date *" value={occurredAt} onChange={setOccurredAt} />

            {/* Contact Type */}
            <Text style={styles.label}>Contact Type *</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowTypeDropdown(!showTypeDropdown)}
            >
              <Text style={styles.dropdownText}>
                {CONTACT_TYPE_LABELS[contactType]}
              </Text>
              <Ionicons
                name={showTypeDropdown ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
            {showTypeDropdown && (
              <View style={styles.dropdownList}>
                {CONTACT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.dropdownItem,
                      contactType === type && styles.dropdownItemSelected,
                    ]}
                    onPress={() => {
                      setContactType(type);
                      setShowTypeDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        contactType === type && styles.dropdownItemTextSelected,
                      ]}
                    >
                      {CONTACT_TYPE_LABELS[type]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Notes */}
            <Text style={styles.label}>Notes *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={note}
              onChangeText={setNote}
              placeholder="What was discussed?"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Attendees */}
            <Text style={styles.label}>Attendees</Text>
            <TextInput
              style={styles.input}
              value={attendees}
              onChangeText={setAttendees}
              placeholder="e.g. John Smith, Jane Doe"
              placeholderTextColor={Colors.textMuted}
            />

            {/* Location */}
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Club Office, Stadium"
              placeholderTextColor={Colors.textMuted}
            />

            {/* Action Items */}
            <Text style={styles.label}>Action Items</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={actionItems}
              onChangeText={setActionItems}
              placeholder="Follow-up actions..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Buttons */}
            <GradientButton
              title={saving ? 'Saving...' : entry ? 'Save Changes' : 'Log Contact'}
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              style={{ marginTop: 16 }}
            />
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  error: {
    color: Colors.error,
    fontSize: 13,
    marginBottom: 12,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  dropdown: {
    backgroundColor: Colors.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 15,
    color: Colors.text,
  },
  dropdownList: {
    backgroundColor: Colors.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
  },
  dropdownItemText: {
    fontSize: 15,
    color: Colors.text,
  },
  dropdownItemTextSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
