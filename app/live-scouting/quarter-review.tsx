import React, { useState, useEffect } from 'react';
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
import { liveScoutingApi, TRAITS, QuarterData } from '../../src/api/liveScouting';

const RATING_OPTIONS = [1, 2, 3, 4, 5];

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
  const [ratings, setRatings] = useState<Record<string, number>>({});

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
          // Pre-populate existing ratings
          const existingRatings: Record<string, number> = {};
          TRAITS.forEach((t) => {
            const val = (qd as any)[t.ratingKey];
            if (val != null) existingRatings[t.ratingKey] = val;
          });
          setRatings(existingRatings);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const setRating = (key: string, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!sessionId || !playerId) return;
    setSaving(true);
    try {
      await liveScoutingApi.saveReview(sessionId, playerId, q, ratings);
      router.back();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save review';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const ratingColor = (val: number) =>
    val <= 2 ? Colors.error : val <= 3 ? Colors.amber : Colors.green;

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

      <Text style={styles.instruction}>Rate each trait from 1 (poor) to 5 (excellent) based on this quarter's performance</Text>

      {TRAITS.map((trait) => {
        const countValue = quarterData ? (quarterData as any)[trait.key] || 0 : 0;
        const currentRating = ratings[trait.ratingKey];
        return (
          <View key={trait.key} style={styles.traitRow}>
            <View style={styles.traitHeader}>
              <Text style={styles.traitLabel}>
                {trait.icon} {trait.label}
              </Text>
              <Text style={styles.traitCount}>Count: {countValue}</Text>
            </View>
            <View style={styles.ratingRow}>
              {RATING_OPTIONS.map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.ratingBtn,
                    currentRating === val && {
                      backgroundColor: ratingColor(val) + '25',
                      borderColor: ratingColor(val),
                    },
                  ]}
                  onPress={() => setRating(trait.ratingKey, val)}
                >
                  <Text
                    style={[
                      styles.ratingBtnText,
                      currentRating === val && { color: ratingColor(val) },
                    ]}
                  >
                    {val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, maxWidth: 600, alignSelf: 'center', width: '100%', paddingBottom: 40 },
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
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },

  traitRow: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  traitHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  traitLabel: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  traitCount: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },

  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  ratingBtnText: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700' },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.green,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 40,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
