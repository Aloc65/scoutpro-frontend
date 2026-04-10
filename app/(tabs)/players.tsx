import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, RefreshControl, TouchableOpacity, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/theme/colors';
import { Player, COMPETITIONS } from '../../src/types';
import Card from '../../src/components/Card';
import EmptyState from '../../src/components/EmptyState';
import Input from '../../src/components/Input';
import GradientButton from '../../src/components/GradientButton';
import DatePicker from '../../src/components/DatePicker';
import { showAlert, showConfirm } from '../../src/utils/alert';

export default function PlayersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', team: '', dateOfBirth: '', competition: '', dominantFoot: '', height: '', weight: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ items: Player[] }>(`/api/players?search=${search}&limit=100`);
      setPlayers(d.items);
    } catch {}
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const addPlayer = async () => {
    if (!form.fullName.trim()) return showAlert('Error', 'Name is required');
    try {
      setSaving(true);
      await api.post('/api/players', {
        fullName: form.fullName,
        team: form.team || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        competition: form.competition || undefined,
        dominantFoot: form.dominantFoot || undefined,
        height: form.height ? parseFloat(form.height) : undefined,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        notes: form.notes || undefined,
      });
      setModalOpen(false);
      setForm({ fullName: '', team: '', dateOfBirth: '', competition: '', dominantFoot: '', height: '', weight: '', notes: '' });
      load();
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePlayer = (id: string, name: string) => {
    showConfirm('Delete Player', `Delete ${name}?`, async () => { await api.delete(`/api/players/${id}`); load(); });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search players..."
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalOpen(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={players}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        ListEmptyComponent={<EmptyState icon="people-outline" message="No players found" actionLabel="Add Player" onAction={() => setModalOpen(true)} />}
        renderItem={({ item }) => (
          <Card
            onPress={() => router.push(`/player/${item.id}`)}
            style={styles.playerCard}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.fullName}</Text>
                <Text style={styles.meta}>{[item.team, item.competition, item.age != null ? `${item.age}yo` : null, item.dominantFoot].filter(Boolean).join(' • ')}</Text>
              </View>
              {user?.role === 'ADMIN' && (
                <TouchableOpacity onPress={() => deletePlayer(item.id, item.fullName)}>
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              )}
            </View>
          </Card>
        )}
      />

      <Modal visible={modalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <ScrollView>
              <Text style={styles.modalTitle}>Add Player</Text>
              <Input label="Full Name *" value={form.fullName} onChangeText={(t) => setForm({ ...form, fullName: t })} />
              <Input label="Team" value={form.team} onChangeText={(t) => setForm({ ...form, team: t })} />
              <DatePicker label="Date of Birth" value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} />
              <Text style={{ color: Colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 4 }}>Competition</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {COMPETITIONS.map((c) => (
                  <TouchableOpacity key={c} onPress={() => setForm({ ...form, competition: form.competition === c ? '' : c })}
                    style={[styles.chip, form.competition === c && styles.chipActive]}>
                    <Text style={[styles.chipText, form.competition === c && { color: '#fff' }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input label="Dominant Foot" value={form.dominantFoot} onChangeText={(t) => setForm({ ...form, dominantFoot: t })} placeholder="Left / Right / Both" />
              <Input label="Height (cm)" value={form.height} onChangeText={(t) => setForm({ ...form, height: t })} keyboardType="numeric" />
              <Input label="Weight (kg)" value={form.weight} onChangeText={(t) => setForm({ ...form, weight: t })} keyboardType="numeric" />
              <Input label="Notes" value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} multiline />
              <GradientButton title="Save" onPress={addPlayer} loading={saving} />
              <TouchableOpacity onPress={() => setModalOpen(false)} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ color: Colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchRow: { flexDirection: 'row', padding: 16, gap: 8 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.elevated, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 10, marginLeft: 8 },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  playerCard: { marginBottom: 10 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text },
  meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 16, textAlign: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
});
