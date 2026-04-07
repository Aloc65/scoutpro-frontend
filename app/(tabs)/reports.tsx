import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { Colors } from '../../src/theme/colors';
import { ReportListItem } from '../../src/types';
import Card from '../../src/components/Card';
import ProjectionBadge from '../../src/components/ProjectionBadge';
import EmptyState from '../../src/components/EmptyState';

export default function ReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ items: ReportListItem[] }>(`/api/reports?search=${search}&limit=100`);
      setReports(d.items);
    } catch {}
  }, [search]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by player name..."
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        ListEmptyComponent={<EmptyState icon="document-text-outline" message="No reports found" />}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/report/${item.id}/edit`)} style={styles.reportCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.playerName}</Text>
                <Text style={styles.meta}>vs {item.opponent} • {new Date(item.matchDate).toLocaleDateString()}</Text>
                <Text style={styles.meta}>{item.scoutName} • {item.primaryPosition}</Text>
              </View>
              <ProjectionBadge value={item.overallProjection} />
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.elevated, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, margin: 16 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 10, marginLeft: 8 },
  reportCard: { marginBottom: 10 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text },
  meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
});
