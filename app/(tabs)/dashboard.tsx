import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/theme/colors';
import { DashboardData } from '../../src/types';
import Card from '../../src/components/Card';
import ProjectionBadge from '../../src/components/ProjectionBadge';
import GradientButton from '../../src/components/GradientButton';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get<DashboardData>('/api/dashboard');
      setData(d);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      <Text style={styles.greeting}>Hello, {user?.name} 👋</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
        {[['people', 'Total Players', data?.totalPlayers], ['document-text', 'Total Reports', data?.totalReports], ['person', 'My Reports', data?.myReports]].map(([icon, label, count], i) => (
          <Card key={i} style={[styles.statCard, i > 0 && { marginLeft: 12 }]}>
            <Ionicons name={icon as any} size={24} color={Colors.accent} />
            <Text style={styles.statCount}>{count ?? '-'}</Text>
            <Text style={styles.statLabel}>{label as string}</Text>
          </Card>
        ))}
      </ScrollView>

      <GradientButton title="+ Quick Add Report" onPress={() => router.push('/report/new')} style={{ marginBottom: 24 }} />

      <Text style={styles.sectionTitle}>Recent Reports</Text>
      {data?.recentReports?.map((r) => (
        <Card key={r.id} onPress={() => router.push(`/report/${r.id}/edit`)} style={styles.reportCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerName}>{r.playerName}</Text>
              <Text style={styles.meta}>vs {r.opponent} • {new Date(r.matchDate).toLocaleDateString()}</Text>
              <Text style={styles.meta}>{r.scoutName}</Text>
            </View>
            <ProjectionBadge value={r.overallProjection} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  greeting: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 20 },
  statCard: { width: 140, alignItems: 'center', paddingVertical: 20 },
  statCount: { fontSize: 28, fontWeight: '800', color: Colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  reportCard: { marginBottom: 12 },
  playerName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
});
