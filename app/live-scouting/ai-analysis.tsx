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
import { Colors, ratingColor } from '../../src/theme/colors';
import {
  liveScoutingApi,
  LiveScoutingSession,
  AiAnalysis,
  TRAITS,
} from '../../src/api/liveScouting';

export default function AiAnalysisScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<LiveScoutingSession | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const s = await liveScoutingApi.getSession(sessionId);
      setSession(s);
      // Check if AI analysis already exists
      if (s.aiSummary) {
        setAnalysis({
          summary: s.aiSummary,
          strengths: (s.aiStrengths as any[]) || [],
          weaknesses: (s.aiWeaknesses as any[]) || [],
          suggestedRatings: (s.aiSuggestedRatings as Record<string, number>) || {},
          analyzedAt: s.aiAnalyzedAt || null,
        });
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const runAnalysis = async () => {
    if (!sessionId) return;
    setAnalyzing(true);
    try {
      const result = await liveScoutingApi.analyzeSession(sessionId);
      setAnalysis(result);
      const msg = 'AI analysis completed successfully!';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err?.message || 'AI analysis failed';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
    } finally {
      setAnalyzing(false);
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>🤖 AI Analysis</Text>
          <Text style={styles.subtitle}>{session?.gameTitle || 'Session'}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Trigger analysis button */}
      {!analysis && !analyzing && (
        <View style={styles.emptyState}>
          <Ionicons name="sparkles-outline" size={48} color={Colors.primary} />
          <Text style={styles.emptyTitle}>Ready to Analyze</Text>
          <Text style={styles.emptyDesc}>
            AI will synthesize your quarter notes, stats, and ratings into a comprehensive analysis with strengths, weaknesses, and suggested ratings.
          </Text>
          <TouchableOpacity style={styles.analyzeBtn} onPress={runAnalysis}>
            <Ionicons name="flash" size={20} color="#fff" />
            <Text style={styles.analyzeBtnText}>Run AI Analysis</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Analyzing progress */}
      {analyzing && (
        <View style={styles.progressCard}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.progressTitle}>Analyzing Session Data...</Text>
          <Text style={styles.progressDesc}>
            Synthesizing notes, stats, and ratings across all quarters and players...
          </Text>
          <View style={styles.progressSteps}>
            {['📊 Processing stats', '📝 Reading notes', '🧠 Generating insights', '⭐ Suggesting ratings'].map((step, i) => (
              <View key={i} style={styles.progressStep}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={styles.progressStepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Analysis results */}
      {analysis && !analyzing && (
        <>
          {/* Summary card */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Summary</Text>
            </View>
            <Text style={styles.summaryText}>{analysis.summary}</Text>
            {analysis.analyzedAt && (
              <Text style={styles.analyzedAt}>
                Analyzed {new Date(analysis.analyzedAt).toLocaleString()}
              </Text>
            )}
          </View>

          {/* Strengths */}
          {analysis.strengths.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trending-up" size={18} color={Colors.green} />
                <Text style={[styles.sectionTitle, { color: Colors.green }]}>Strengths</Text>
              </View>
              {analysis.strengths.map((s, i) => (
                <View key={i} style={styles.insightRow}>
                  <View style={styles.insightBadge}>
                    <Text style={[styles.insightRating, { color: Colors.green }]}>{s.rating}/5</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insightTrait}>{s.trait}</Text>
                    <Text style={styles.insightEvidence}>{s.evidence}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Weaknesses */}
          {analysis.weaknesses.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trending-down" size={18} color={Colors.error} />
                <Text style={[styles.sectionTitle, { color: Colors.error }]}>Areas for Improvement</Text>
              </View>
              {analysis.weaknesses.map((w, i) => (
                <View key={i} style={styles.insightRow}>
                  <View style={styles.insightBadge}>
                    <Text style={[styles.insightRating, { color: Colors.error }]}>{w.rating}/5</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insightTrait}>{w.trait}</Text>
                    <Text style={styles.insightEvidence}>{w.evidence}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Suggested Ratings */}
          {analysis.suggestedRatings && Object.keys(analysis.suggestedRatings).length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Ionicons name="star" size={18} color={Colors.amber} />
                <Text style={[styles.sectionTitle, { color: Colors.amber }]}>Suggested Ratings</Text>
              </View>
              <View style={styles.ratingsGrid}>
                {TRAITS.map((t) => {
                  const val = analysis.suggestedRatings[t.ratingKey];
                  if (val == null) return null;
                  return (
                    <View key={t.ratingKey} style={styles.ratingItem}>
                      <Text style={styles.ratingLabel}>{t.icon} {t.label}</Text>
                      <Text style={[styles.ratingValue, { color: ratingColor(val) }]}>{val}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Regenerate button */}
          <TouchableOpacity style={styles.regenerateBtn} onPress={runAnalysis}>
            <Ionicons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.regenerateText}>Regenerate Analysis</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, maxWidth: 700, alignSelf: 'center', width: '100%', paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.elevated, justifyContent: 'center', alignItems: 'center',
  },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: Colors.accent, fontSize: 14, fontWeight: '600', marginTop: 2 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { color: Colors.text, fontSize: 22, fontWeight: '800', marginTop: 16 },
  emptyDesc: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24, maxWidth: 400 },
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 16, borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Progress
  progressCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 24,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  progressTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', marginTop: 16 },
  progressDesc: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  progressSteps: { gap: 12, width: '100%', maxWidth: 300 },
  progressStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressStepText: { color: Colors.text, fontSize: 13 },

  // Section cards
  sectionCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },

  summaryText: { color: Colors.text, fontSize: 14, lineHeight: 22 },
  analyzedAt: { color: Colors.textMuted, fontSize: 11, marginTop: 10 },

  // Insights
  insightRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  insightBadge: {
    backgroundColor: Colors.elevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    minWidth: 40, alignItems: 'center',
  },
  insightRating: { fontSize: 13, fontWeight: '800' },
  insightTrait: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  insightEvidence: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },

  // Ratings grid
  ratingsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ratingItem: {
    backgroundColor: Colors.elevated, borderRadius: 10, padding: 10,
    minWidth: '28%' as any, flexGrow: 1, alignItems: 'center',
  },
  ratingLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  ratingValue: { fontSize: 20, fontWeight: '800' },

  // Regenerate
  regenerateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.primary, backgroundColor: 'rgba(79,70,229,0.08)',
    marginBottom: 40,
  },
  regenerateText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
