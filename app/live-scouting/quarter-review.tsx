import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { liveScoutingApi, TRAITS, QuarterData, calcTraitRating } from '../../src/api/liveScouting';

export default function QuarterReviewScreen() {
  const router = useRouter();
  const { sessionId, playerId, quarter } = useLocalSearchParams<{
    sessionId: string;
    playerId: string;
    quarter: string;
  }>();
  const q = parseInt(quarter || '1');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quarterData, setQuarterData] = useState<QuarterData | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [notes, setNotes] = useState('');

  // Local editable counts for each trait
  const [counts, setCounts] = useState<Record<string, number>>({});

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
        if (qd) {
          setQuarterData(qd);
          setNotes(qd.notes || '');
          // Pre-populate counts
          const c: Record<string, number> = {};
          TRAITS.forEach((t) => {
            c[t.posKey] = (qd as any)[t.posKey] || 0;
            c[t.negKey] = (qd as any)[t.negKey] || 0;
          });
          setCounts(c);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const adjustCount = (key: string, delta: number) => {
    setCounts((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + delta),
    }));
  };

  const handleSave = async () => {
    if (!sessionId || !playerId) return;
    setSaving(true);
    try {
      // Save adjusted counts + notes via the review endpoint
      const payload: Record<string, any> = { notes };
      TRAITS.forEach((t) => {
        payload[t.posKey] = counts[t.posKey] || 0;
        payload[t.negKey] = counts[t.negKey] || 0;
      });
      await liveScoutingApi.saveReview(sessionId, playerId, q, payload);
      router.back();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save review';
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>Quarter {q} Review</Text>
          <Text style={styles.subtitle}>{playerName}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <Text style={styles.instruction}>
        Review & adjust trait observation counts. Ratings are auto-calculated from the +/- ratio.
      </Text>

      {/* Scoring summary */}
      {quarterData && (
        <View style={styles.scoringSummary}>
          <Text style={styles.scoringText}>
            ⚽ Goals: {quarterData.goals}   🥅 Behinds: {quarterData.behinds}
          </Text>
        </View>
      )}

      {/* Trait review rows */}
      {TRAITS.map((trait) => {
        const pos = counts[trait.posKey] || 0;
        const neg = counts[trait.negKey] || 0;
        const rating = calcTraitRating(pos, neg);

        return (
          <View key={trait.posKey} style={styles.traitCard}>
            <View style={styles.traitHeader}>
              <Text style={styles.traitLabel}>{trait.icon} {trait.label}</Text>
              {rating !== null ? (
                <View style={[styles.ratingBadge, { backgroundColor: ratingBg(rating) }]}>
                  <Text style={[styles.ratingText, { color: ratingFg(rating) }]}>
                    {rating.toFixed(1)} / 5
                  </Text>
                </View>
              ) : (
                <Text style={styles.noRating}>No data</Text>
              )}
            </View>

            <View style={styles.countsRow}>
              {/* Positive count */}
              <View style={styles.countGroup}>
                <Text style={styles.countLabel}>Good (+)</Text>
                <View style={styles.countControls}>
                  <TouchableOpacity
                    style={styles.smallBtnMinus}
                    onPress={() => adjustCount(trait.posKey, -1)}
                  >
                    <Text style={styles.smallBtnMinusText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.countValuePos}>{pos}</Text>
                  <TouchableOpacity
                    style={styles.smallBtnPlus}
                    onPress={() => adjustCount(trait.posKey, 1)}
                  >
                    <Text style={styles.smallBtnPlusText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Negative count */}
              <View style={styles.countGroup}>
                <Text style={styles.countLabel}>Poor (−)</Text>
                <View style={styles.countControls}>
                  <TouchableOpacity
                    style={styles.smallBtnMinus}
                    onPress={() => adjustCount(trait.negKey, -1)}
                  >
                    <Text style={styles.smallBtnMinusText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.countValueNeg}>{neg}</Text>
                  <TouchableOpacity
                    style={styles.smallBtnPlus}
                    onPress={() => adjustCount(trait.negKey, 1)}
                  >
                    <Text style={styles.smallBtnPlusText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        );
      })}

      {/* Notes */}
      <Text style={styles.notesLabel}>📝 Quarter Notes</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={setNotes}
        placeholder="Add observations, context, or notes for this quarter..."
        placeholderTextColor={Colors.textMuted}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>Save Quarter Review</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function ratingBg(rating: number) {
  if (rating >= 4) return 'rgba(16,185,129,0.15)';
  if (rating >= 3) return 'rgba(245,158,11,0.15)';
  return 'rgba(239,68,68,0.15)';
}

function ratingFg(rating: number) {
  if (rating >= 4) return '#10B981';
  if (rating >= 3) return '#F59E0B';
  return '#EF4444';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.elevated, justifyContent: 'center', alignItems: 'center',
  },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: Colors.accent, fontSize: 14, fontWeight: '600', marginTop: 2 },

  instruction: {
    color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 18,
  },

  scoringSummary: {
    backgroundColor: Colors.elevated, borderRadius: 10, padding: 12, marginBottom: 16, alignItems: 'center',
  },
  scoringText: { color: Colors.text, fontSize: 14, fontWeight: '700' },

  traitCard: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 10,
  },
  traitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  traitLabel: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  ratingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  ratingText: { fontSize: 13, fontWeight: '800' },
  noRating: { color: Colors.textMuted, fontSize: 12 },

  countsRow: { flexDirection: 'row', gap: 16 },
  countGroup: { flex: 1 },
  countLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  countControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  smallBtnMinus: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  smallBtnPlus: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  smallBtnMinusText: { fontSize: 18, fontWeight: '700', color: '#EF4444' },
  smallBtnPlusText: { fontSize: 18, fontWeight: '700', color: '#10B981' },
  countValuePos: { fontSize: 18, fontWeight: '800', color: '#10B981', minWidth: 28, textAlign: 'center' },
  countValueNeg: { fontSize: 18, fontWeight: '800', color: '#EF4444', minWidth: 28, textAlign: 'center' },

  notesLabel: { color: Colors.text, fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 8 },
  notesInput: {
    backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 14, color: Colors.text, fontSize: 14, minHeight: 100,
  },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.green, paddingVertical: 16, borderRadius: 12,
    marginTop: 16, marginBottom: 40,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
