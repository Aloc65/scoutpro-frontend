import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { COMPETITIONS } from '../../src/types';
import { liveScoutingApi } from '../../src/api/liveScouting';

export default function NewSessionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [venue, setVenue] = useState('');
  const [competition, setCompetition] = useState('');
  const [gameDate, setGameDate] = useState(new Date().toISOString().split('T')[0]);
  const [gameTime, setGameTime] = useState('14:00');

  const canSubmit = homeTeam.trim() && awayTeam.trim();

  const handleCreate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const gameTitle = `${homeTeam.trim()} vs ${awayTeam.trim()}`;
      // Build a robust ISO 8601 date string
      const parsed = new Date(`${gameDate}T${gameTime}:00`);
      if (isNaN(parsed.getTime())) {
        const errMsg = 'Invalid date or time. Please use YYYY-MM-DD for date and HH:MM for time.';
        if (Platform.OS === 'web') { window.alert(errMsg); } else { Alert.alert('Error', errMsg); }
        setLoading(false);
        return;
      }
      const dateTime = parsed.toISOString();
      const session = await liveScoutingApi.createSession({
        gameTitle,
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        venue: venue.trim() || undefined,
        competition: competition || undefined,
        gameDate: dateTime,
      });
      router.replace(`/live-scouting/add-players?sessionId=${session.id}` as any);
    } catch (err: any) {
      const msg = err?.message || 'Failed to create session';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="recording-outline" size={28} color={Colors.accent} />
        <Text style={styles.title}>New Live Scouting Session</Text>
        <Text style={styles.subtitle}>Set up the game details to begin scouting</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Game Details</Text>

        <Text style={styles.label}>Home Team *</Text>
        <TextInput
          style={styles.input}
          value={homeTeam}
          onChangeText={setHomeTeam}
          placeholder="e.g. Swan Districts"
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.label}>Away Team *</Text>
        <TextInput
          style={styles.input}
          value={awayTeam}
          onChangeText={setAwayTeam}
          placeholder="e.g. Peel Thunder"
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.label}>Venue</Text>
        <TextInput
          style={styles.input}
          value={venue}
          onChangeText={setVenue}
          placeholder="e.g. Steel Blue Oval"
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.label}>Competition</Text>
        <View style={styles.competitionRow}>
          {COMPETITIONS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.compChip, competition === c && styles.compChipActive]}
              onPress={() => setCompetition(competition === c ? '' : c)}
            >
              <Text style={[styles.compChipText, competition === c && styles.compChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.label}>Date *</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={gameDate}
                onChange={(e: any) => setGameDate(e.target.value)}
                style={{
                  backgroundColor: Colors.elevated,
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: Colors.text,
                  fontSize: 15,
                  border: `1px solid ${Colors.border}`,
                  outline: 'none',
                  fontFamily: 'inherit',
                  width: '100%',
                  boxSizing: 'border-box' as any,
                }}
              />
            ) : (
              <TextInput
                style={styles.input}
                value={gameDate}
                onChangeText={setGameDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
            )}
          </View>
          <View style={styles.dateField}>
            <Text style={styles.label}>Time</Text>
            {Platform.OS === 'web' ? (
              <input
                type="time"
                value={gameTime}
                onChange={(e: any) => setGameTime(e.target.value)}
                style={{
                  backgroundColor: Colors.elevated,
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: Colors.text,
                  fontSize: 15,
                  border: `1px solid ${Colors.border}`,
                  outline: 'none',
                  fontFamily: 'inherit',
                  width: '100%',
                  boxSizing: 'border-box' as any,
                }}
              />
            ) : (
              <TextInput
                style={styles.input}
                value={gameTime}
                onChangeText={setGameTime}
                placeholder="HH:MM"
                placeholderTextColor={Colors.textMuted}
              />
            )}
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.createBtn, !canSubmit && styles.createBtnDisabled]}
        onPress={handleCreate}
        disabled={!canSubmit || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="play-circle-outline" size={20} color="#fff" />
            <Text style={styles.createBtnText}>Create Session & Add Players</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, maxWidth: 600, alignSelf: 'center', width: '100%' },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  title: { color: Colors.text, fontSize: 22, fontWeight: '800', marginTop: 8 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 16 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  competitionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  compChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  compChipActive: { backgroundColor: 'rgba(6,182,212,0.15)', borderColor: Colors.accent },
  compChipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  compChipTextActive: { color: Colors.accent },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
