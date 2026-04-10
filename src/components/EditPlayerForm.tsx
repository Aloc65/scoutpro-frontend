import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, ScrollView,
  TouchableOpacity, Platform, Alert, KeyboardAvoidingView,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Player, COMPETITIONS } from '../types';
import GradientButton from './GradientButton';
import DatePicker from './DatePicker';
import { Ionicons } from '@expo/vector-icons';

const DOMINANT_FOOT_OPTIONS = ['Left', 'Right', 'Both'];

interface EditPlayerFormProps {
  visible: boolean;
  player: Player;
  onSave: (data: Partial<Player>) => Promise<void>;
  onClose: () => void;
}

export default function EditPlayerForm({ visible, player, onSave, onClose }: EditPlayerFormProps) {
  const [fullName, setFullName] = useState('');
  const [team, setTeam] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [competition, setCompetition] = useState('');
  const [dominantFoot, setDominantFoot] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCompDropdown, setShowCompDropdown] = useState(false);
  const [showFootDropdown, setShowFootDropdown] = useState(false);

  useEffect(() => {
    if (player && visible) {
      setFullName(player.fullName || '');
      setTeam(player.team || '');
      // Convert ISO datetime to YYYY-MM-DD for DatePicker
      if (player.dateOfBirth) {
        const d = new Date(player.dateOfBirth);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          setDateOfBirth(`${yyyy}-${mm}-${dd}`);
        } else {
          setDateOfBirth('');
        }
      } else {
        setDateOfBirth('');
      }
      setCompetition(player.competition || '');
      setDominantFoot(player.dominantFoot || '');
      setHeight(player.height != null ? String(player.height) : '');
      setWeight(player.weight != null ? String(player.weight) : '');
      setNotes(player.notes || '');
      setError('');
    }
  }, [player, visible]);

  const handleSave = async () => {
    setError('');
    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }
    if (height && (isNaN(Number(height)) || Number(height) < 50 || Number(height) > 250)) {
      setError('Height must be between 50 and 250 cm');
      return;
    }
    if (weight && (isNaN(Number(weight)) || Number(weight) < 20 || Number(weight) > 200)) {
      setError('Weight must be between 20 and 200 kg');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        fullName: fullName.trim(),
        team: team.trim() || null,
        dateOfBirth: dateOfBirth || null,
        competition: competition || null,
        dominantFoot: dominantFoot || null,
        height: height ? Number(height) : null,
        weight: weight ? Number(weight) : null,
        notes: notes.trim() || null,
      } as any);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderDropdown = (
    label: string,
    value: string,
    options: readonly string[],
    show: boolean,
    setShow: (v: boolean) => void,
    onChange: (v: string) => void,
  ) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => { setShow(!show); setShowCompDropdown(false); setShowFootDropdown(false); setShow(!show); }}
        activeOpacity={0.7}
      >
        <Text style={[styles.dropdownText, !value && { color: Colors.textMuted }]}>
          {value || `Select ${label}`}
        </Text>
        <Ionicons name={show ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
      </TouchableOpacity>
      {show && (
        <View style={styles.dropdownList}>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => { onChange(''); setShow(false); }}
          >
            <Text style={[styles.dropdownItemText, { color: Colors.textMuted, fontStyle: 'italic' }]}>None</Text>
          </TouchableOpacity>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.dropdownItem, value === opt && styles.dropdownItemActive]}
              onPress={() => { onChange(opt); setShow(false); }}
            >
              <Text style={[styles.dropdownItemText, value === opt && { color: Colors.accent }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="create-outline" size={22} color={Colors.accent} />
              <Text style={styles.headerTitle}>Edit Player</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 24 }}>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Player full name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Team */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Team</Text>
              <TextInput
                style={styles.input}
                value={team}
                onChangeText={setTeam}
                placeholder="Team name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Date of Birth */}
            <View style={styles.fieldContainer}>
              <DatePicker label="Date of Birth" value={dateOfBirth} onChange={setDateOfBirth} />
            </View>

            {/* Competition dropdown */}
            {renderDropdown('Competition', competition, COMPETITIONS, showCompDropdown, setShowCompDropdown, setCompetition)}

            {/* Dominant Foot dropdown */}
            {renderDropdown('Dominant Foot', dominantFoot, DOMINANT_FOOT_OPTIONS, showFootDropdown, setShowFootDropdown, setDominantFoot)}

            {/* Height */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                value={height}
                onChangeText={setHeight}
                placeholder="Height in cm"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            {/* Weight */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                placeholder="Weight in kg"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            {/* Notes */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes about the player"
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Footer buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <GradientButton title={saving ? 'Saving...' : 'Save Changes'} onPress={handleSave} disabled={saving} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    maxHeight: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownText: {
    color: Colors.text,
    fontSize: 15,
  },
  dropdownList: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(6,182,212,0.1)',
  },
  dropdownItemText: {
    fontSize: 14,
    color: Colors.text,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
