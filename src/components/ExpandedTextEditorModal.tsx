import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import GradientButton from './GradientButton';

interface Props {
  /** Whether the modal is visible. */
  visible: boolean;
  /** Header title (e.g. "Edit Summary"). */
  title?: string;
  /** The text to load into the editor when it opens. */
  initialValue: string;
  /** Placeholder shown when the editor is empty. */
  placeholder?: string;
  /** Optional helper hint shown under the editor. */
  hint?: string;
  /** Called with the edited text when the user taps Save. */
  onSave: (value: string) => void;
  /** Called when the user cancels / dismisses the modal. */
  onClose: () => void;
}

/**
 * A full-screen-ish modal that provides a large, scrollable text editing area.
 * Used to make editing long-form fields (e.g. a report Summary) far easier than
 * a small inline multiline input. Includes a live word/character count and
 * prominent Save / Cancel actions. Dismissable via the X button, Cancel, the
 * hardware back button (Android) or by tapping the backdrop.
 */
export default function ExpandedTextEditorModal({
  visible,
  title = 'Edit',
  initialValue,
  placeholder,
  hint,
  onSave,
  onClose,
}: Props) {
  const [text, setText] = useState(initialValue);

  // Re-seed the editor every time it is (re)opened so it always reflects the
  // latest underlying value and discards any unsaved edits from a prior open.
  useEffect(() => {
    if (visible) setText(initialValue);
  }, [visible, initialValue]);

  const trimmed = text.trim();
  const charCount = text.length;
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Tap-outside-to-dismiss backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="create-outline" size={20} color={Colors.accent} />
              <Text style={styles.headerTitle}>{title}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Large editing area (multiline TextInput scrolls internally) */}
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={Colors.textMuted}
            multiline
            autoFocus
            textAlignVertical="top"
            scrollEnabled
          />

          {hint ? <Text style={styles.hint}>{hint}</Text> : null}

          {/* Footer: count + actions */}
          <View style={styles.footer}>
            <Text style={styles.count}>
              {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} {charCount === 1 ? 'char' : 'chars'}
            </Text>
            <View style={styles.footerBtns}>
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <View style={styles.saveBtnWrap}>
                <GradientButton title="Save" icon="checkmark" onPress={() => onSave(text)} />
              </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modal: {
    width: '100%',
    maxWidth: 640,
    height: '85%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
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
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  count: {
    color: Colors.textMuted,
    fontSize: 12,
    flexShrink: 1,
  },
  footerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtnWrap: {
    minWidth: 120,
  },
});
