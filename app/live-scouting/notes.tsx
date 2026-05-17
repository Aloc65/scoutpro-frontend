import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { liveScoutingApi } from '../../src/api/liveScouting';

export default function NotesScreen() {
  const router = useRouter();
  const { sessionId, playerId, quarter } = useLocalSearchParams<{
    sessionId: string;
    playerId: string;
    quarter: string;
  }>();
  const q = parseInt(quarter || '1');

  const [notes, setNotes] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [sessionId, playerId, quarter]);

  const loadData = async () => {
    if (!sessionId) return;
    try {
      const session = await liveScoutingApi.getSession(sessionId);
      const sp = session.sessionPlayers.find((s) => s.playerId === playerId);
      if (sp) {
        setPlayerName(sp.player.fullName);
        const qd = sp.quarterData.find((d) => d.quarter === q);
        if (qd?.notes) setNotes(qd.notes);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!sessionId || !playerId) return;
    setSaving(true);
    try {
      await liveScoutingApi.saveNotes(sessionId, playerId, q, notes);
      router.back();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save notes';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.title}>Q{q} Notes</Text>
            <Text style={styles.subtitle}>{playerName}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <Text style={styles.instruction}>
          Add observations, key moments, and performance notes for this quarter
        </Text>

        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Strong start, won 3 contested possessions early. Moved well in space. Kicked a great goal from 45m on the run..."
          placeholderTextColor={Colors.textMuted}
          multiline
          textAlignVertical="top"
          autoFocus
        />

        <Text style={styles.charCount}>{notes.length} characters</Text>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Save Notes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 16, maxWidth: 600, alignSelf: 'center', width: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: Colors.accent, fontSize: 14, fontWeight: '600', marginTop: 2 },

  instruction: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 12,
  },

  notesInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 200,
  },

  charCount: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
    marginBottom: 12,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
