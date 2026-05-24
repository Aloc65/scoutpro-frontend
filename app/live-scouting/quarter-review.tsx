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
import { liveScoutingApi, TRAITS, SLIDER_TRAITS, QuarterData, calcTraitRating } from '../../src/api/liveScouting';
import { POSITIONS } from '../../src/types';

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
  const [playerLocked, setPlayerLocked] = useState<string | null>(null); // 'DNP' | 'INJ' | null
  const [quarterData, setQuarterData] = useState<QuarterData | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [notes, setNotes] = useState('');
  const [position, setPosition] = useState<string>('');
  const [sessionPosition, setSessionPosition] = useState<string>('');

  // Local editable counts for each trait
  const [counts, setCounts] = useState<Record<string, number>>({});
  // Slider ratings for athletic/holistic traits (null = not yet rated)
  const [sliderRatings, setSliderRatings] = useState<Record<string, number | null>>({
    speedRating: null,
    flexibilityRating: null,
    gameAwarenessRating: null,
  });

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
        setSessionPosition(sp.position || '');
        if (sp.status) setPlayerLocked(sp.status);
        const qd = sp.quarterData.find((d) => d.quarter === q);
        if (qd) {
          setQuarterData(qd);
          setNotes(qd.notes || '');
          // Use quarter position, fallback to session position
          setPosition(qd.position || sp.position || '');
          // Pre-populate counts
          const c: Record<string, number> = {};
          TRAITS.forEach((t) => {
            c[t.posKey] = (qd as any)[t.posKey] || 0;
            c[t.negKey] = (qd as any)[t.negKey] || 0;
          });
          setCounts(c);
          // Pre-populate slider ratings
          setSliderRatings({
            speedRating: qd.speedRating ?? null,
            flexibilityRating: qd.flexibilityRating ?? null,
            gameAwarenessRating: qd.gameAwarenessRating ?? null,
          });
        } else {
          setPosition(sp.position || '');
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
      // Save adjusted counts + notes + position + slider ratings via the review endpoint
      const payload: Record<string, any> = { notes, position: position || undefined };
      TRAITS.forEach((t) => {
        payload[t.posKey] = counts[t.posKey] || 0;
        payload[t.negKey] = counts[t.negKey] || 0;
      });
      // Include slider ratings (only if set)
      SLIDER_TRAITS.forEach((st) => {
        if (sliderRatings[st.key] != null) {
          payload[st.key] = sliderRatings[st.key];
        }
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

      {playerLocked && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: playerLocked === 'DNP' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
          borderWidth: 1, borderColor: playerLocked === 'DNP' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)',
          borderRadius: 12, padding: 12, marginBottom: 12,
        }}>
          <Ionicons name={playerLocked === 'DNP' ? 'close-circle' : 'medkit'} size={20} color={playerLocked === 'DNP' ? '#EF4444' : '#F59E0B'} />
          <Text style={{ color: Colors.textSecondary, fontSize: 13, flex: 1 }}>
            Player marked as {playerLocked}. Editing is disabled.
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.elevated }}>
            <Text style={{ color: Colors.accent, fontSize: 12, fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.instruction}>
        Review & adjust trait observation counts. Ratings are auto-calculated from the +/- ratio.
      </Text>

      {/* Position selector */}
      <View style={styles.positionSection}>
        <Text style={styles.positionLabel}>📍 Position this Quarter</Text>
        {sessionPosition && position !== sessionPosition && (
          <Text style={styles.positionChanged}>
            Changed from session default: {sessionPosition}
          </Text>
        )}
        <View style={styles.positionGrid}>
          {POSITIONS.map((pos) => (
            <TouchableOpacity
              key={pos}
              style={[styles.positionChip, position === pos && styles.positionChipActive]}
              onPress={() => setPosition(pos)}
            >
              <Text style={[styles.positionChipText, position === pos && styles.positionChipTextActive]}>
                {pos}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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

      {/* Athletic / Holistic Slider Ratings */}
      <View style={styles.sliderSection}>
        <Text style={styles.sliderSectionTitle}>🏃 Rate Athletic Traits</Text>
        <Text style={styles.sliderSectionHint}>
          Tap a rating for each trait (1.0–5.0). Leave blank if not observed this quarter.
        </Text>

        {SLIDER_TRAITS.map((st) => {
          const currentVal = sliderRatings[st.key];
          const STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
          return (
            <View key={st.key} style={styles.sliderCard}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>{st.icon} {st.label}</Text>
                {currentVal != null ? (
                  <View style={[styles.ratingBadge, { backgroundColor: ratingBg(currentVal) }]}>
                    <Text style={[styles.ratingText, { color: ratingFg(currentVal) }]}>
                      {currentVal.toFixed(1)} / 5
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.noRating}>Not rated</Text>
                )}
              </View>
              <Text style={styles.sliderDescription}>{st.description}</Text>
              <View style={styles.sliderSteps}>
                {STEPS.map((step) => (
                  <TouchableOpacity
                    key={step}
                    style={[
                      styles.sliderStep,
                      currentVal === step && styles.sliderStepActive,
                    ]}
                    onPress={() =>
                      setSliderRatings((prev) => ({
                        ...prev,
                        [st.key]: prev[st.key] === step ? null : step, // toggle off if same
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.sliderStepText,
                        currentVal === step && styles.sliderStepTextActive,
                      ]}
                    >
                      {Number.isInteger(step) ? step.toString() : step.toFixed(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
      </View>

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

      <TouchableOpacity style={[styles.saveBtn, !!playerLocked && { opacity: 0.4 }]} onPress={handleSave} disabled={saving || !!playerLocked}>
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

  positionSection: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  positionLabel: { color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  positionChanged: { color: Colors.amber, fontSize: 11, fontWeight: '600', marginBottom: 6 },
  positionGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6,
  },
  positionChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
    backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border,
    minWidth: 52, alignItems: 'center',
  },
  positionChipActive: {
    backgroundColor: 'rgba(99,102,241,0.15)', borderColor: Colors.accent,
  },
  positionChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  positionChipTextActive: { color: Colors.accent, fontWeight: '700' },

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

  // ─── Slider rating styles ──────────────────────────────────────────
  sliderSection: {
    marginTop: 16, marginBottom: 8,
  },
  sliderSectionTitle: {
    color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 4,
  },
  sliderSectionHint: {
    color: Colors.textSecondary, fontSize: 12, marginBottom: 12, lineHeight: 16,
  },
  sliderCard: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 10,
  },
  sliderHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
  },
  sliderLabel: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  sliderDescription: {
    color: Colors.textSecondary, fontSize: 11, marginBottom: 10, lineHeight: 15,
  },
  sliderSteps: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
  },
  sliderStep: {
    width: 38, height: 34, borderRadius: 8,
    backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  sliderStepActive: {
    backgroundColor: 'rgba(99,102,241,0.2)', borderColor: Colors.accent,
  },
  sliderStepText: {
    color: Colors.textSecondary, fontSize: 12, fontWeight: '600',
  },
  sliderStepTextActive: {
    color: Colors.accent, fontWeight: '800',
  },

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
