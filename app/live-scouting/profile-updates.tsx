import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { liveScoutingApi, ProfileSuggestion } from '../../src/api/liveScouting';

export default function ProfileUpdatesScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  const loadSuggestions = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await liveScoutingApi.suggestProfileUpdates(sessionId);
      setSuggestions(res.suggestions);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load suggestions';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  const applyUpdate = async (playerId: string, field: string, value: any) => {
    const key = `${playerId}-${field}`;
    setApplying(key);
    try {
      await liveScoutingApi.applyProfileUpdate(playerId, field, value);
      setApplied((prev) => new Set(prev).add(key));
      const msg = 'Profile updated successfully!';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err?.message || 'Failed to apply update';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setApplying(null);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>Profile Updates</Text>
          <Text style={styles.subtitle}>Suggested changes from scouting session</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {suggestions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color={Colors.green} />
          <Text style={styles.emptyTitle}>All Up to Date</Text>
          <Text style={styles.emptyDesc}>No profile updates needed based on this session.</Text>
        </View>
      ) : (
        suggestions.map((ps) => (
          <View key={ps.playerId} style={styles.playerCard}>
            <Text style={styles.playerName}>{ps.playerName}</Text>
            {ps.updates.map((upd, i) => {
              const key = `${ps.playerId}-${upd.field}`;
              const isApplied = applied.has(key);
              const isApplying = applying === key;

              return (
                <View key={i} style={styles.updateRow}>
                  <View style={styles.updateInfo}>
                    <Text style={styles.updateLabel}>{upd.label}</Text>
                    <Text style={styles.updateReason}>{upd.reason}</Text>
                    <View style={styles.comparisonRow}>
                      <View style={styles.comparisonBox}>
                        <Text style={styles.compLabel}>Current</Text>
                        <Text style={styles.compValue}>{String(upd.currentValue || '—')}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
                      <View style={[styles.comparisonBox, styles.compNew]}>
                        <Text style={styles.compLabel}>Suggested</Text>
                        <Text style={[styles.compValue, { color: Colors.accent }]}>{String(upd.suggestedValue)}</Text>
                      </View>
                    </View>
                  </View>
                  {isApplied ? (
                    <View style={styles.appliedBadge}>
                      <Ionicons name="checkmark" size={16} color={Colors.green} />
                      <Text style={styles.appliedText}>Applied</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.applyBtn}
                      onPress={() => applyUpdate(ps.playerId, upd.field, upd.suggestedValue)}
                      disabled={isApplying}
                    >
                      {isApplying ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={14} color="#fff" />
                          <Text style={styles.applyBtnText}>Apply</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, maxWidth: 650, alignSelf: 'center', width: '100%', paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.elevated, justifyContent: 'center', alignItems: 'center',
  },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '800', marginTop: 16 },
  emptyDesc: { color: Colors.textSecondary, fontSize: 14, marginTop: 8 },

  playerCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16,
  },
  playerName: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 12 },

  updateRow: {
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, marginTop: 8,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  updateInfo: { flex: 1 },
  updateLabel: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  updateReason: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 8 },

  comparisonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  comparisonBox: {
    backgroundColor: Colors.elevated, borderRadius: 8, padding: 8, flex: 1,
  },
  compNew: { borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)' },
  compLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
  compValue: { color: Colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },

  applyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.green, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  appliedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 8,
  },
  appliedText: { color: Colors.green, fontSize: 12, fontWeight: '700' },
});
