import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { liveScoutingApi, LiveScoutingSession } from '../../src/api/liveScouting';
import { useAuth } from '../../src/context/AuthContext';
import { showAlert, showConfirm } from '../../src/utils/alert';

export default function SessionsListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [sessions, setSessions] = useState<LiveScoutingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await liveScoutingApi.getSessions();
      setSessions(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleDeleteSession = (session: LiveScoutingSession) => {
    const playerCount = session.sessionPlayers?.length || 0;
    const msg = playerCount > 0
      ? `Delete "${session.gameTitle}" with ${playerCount} player${playerCount !== 1 ? 's' : ''} and all tracking data? This cannot be undone.`
      : `Delete "${session.gameTitle}"? This session has no players or data.`;

    showConfirm('Delete Session', msg, async () => {
      setDeletingId(session.id);
      try {
        await liveScoutingApi.deleteSession(session.id);
        setSessions((prev) => prev.filter((s) => s.id !== session.id));
        showAlert('Deleted', `"${session.gameTitle}" has been deleted.`);
      } catch (e: any) {
        showAlert('Error', e.message || 'Failed to delete session');
      } finally {
        setDeletingId(null);
      }
    });
  };

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadSessions();
  };

  const openSession = (session: LiveScoutingSession) => {
    if (session.status === 'ACTIVE') {
      router.push(`/live-scouting/tracking?sessionId=${session.id}` as any);
    } else {
      router.push(`/live-scouting/session-summary?sessionId=${session.id}` as any);
    }
  };

  const renderSession = ({ item }: { item: LiveScoutingSession }) => {
    const playerCount = item.sessionPlayers?.length || 0;
    const isActive = item.status === 'ACTIVE';
    const isDeleting = deletingId === item.id;
    return (
      <TouchableOpacity style={styles.sessionCard} onPress={() => openSession(item)} disabled={isDeleting}>
        <View style={styles.sessionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sessionTitle}>{item.gameTitle}</Text>
            <Text style={styles.sessionMeta}>
              {[item.competition, item.venue].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusCompleted]}>
              <View style={[styles.statusDot, { backgroundColor: isActive ? Colors.accent : Colors.green }]} />
              <Text style={[styles.statusText, { color: isActive ? Colors.accent : Colors.green }]}>
                {item.status}
              </Text>
            </View>
            {isAdmin && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteSession(item)}
                disabled={isDeleting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={Colors.error} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={Colors.error} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.sessionFooter}>
          <Text style={styles.sessionDate}>
            <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />{' '}
            {new Date(item.gameDate).toLocaleDateString()}
          </Text>
          <Text style={styles.sessionPlayers}>
            <Ionicons name="people-outline" size={12} color={Colors.textMuted} /> {playerCount} player
            {playerCount !== 1 ? 's' : ''}
          </Text>
        </View>
        {isActive && (
          <View style={styles.resumeRow}>
            <Ionicons name="play-circle" size={16} color={Colors.accent} />
            <Text style={styles.resumeText}>Tap to resume scouting</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Live Scouting</Text>
          <Text style={styles.subtitle}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push('/live-scouting/new-session' as any)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newBtnText}>New Session</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="recording-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Scouting Sessions</Text>
            <Text style={styles.emptySubtitle}>Start a new live scouting session to track players during a game</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  list: { padding: 16, maxWidth: 600, alignSelf: 'center', width: '100%' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  newBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  sessionCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  sessionHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  sessionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  sessionMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusActive: { backgroundColor: 'rgba(6,182,212,0.12)' },
  statusCompleted: { backgroundColor: 'rgba(16,185,129,0.12)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  sessionFooter: { flexDirection: 'row', gap: 16, marginTop: 10 },
  sessionDate: { color: Colors.textMuted, fontSize: 12 },
  sessionPlayers: { color: Colors.textMuted, fontSize: 12 },
  resumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  resumeText: { color: Colors.accent, fontSize: 13, fontWeight: '600' },

  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySubtitle: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 6, maxWidth: 280 },
});
