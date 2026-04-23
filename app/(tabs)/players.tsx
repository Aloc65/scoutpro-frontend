import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, getToken } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/theme/colors';
import { Player, COMPETITIONS, SIGNING_STATUSES, SIGNING_STATUS_LABELS, SigningStatus } from '../../src/types';
import Card from '../../src/components/Card';
import EmptyState from '../../src/components/EmptyState';
import Input from '../../src/components/Input';
import GradientButton from '../../src/components/GradientButton';
import { showAlert, showConfirm } from '../../src/utils/alert';

const COMPETITION_OPTIONS = ['All', ...COMPETITIONS] as const;

export default function PlayersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', team: '', dateOfBirth: '', draftYear: '', competition: '', dominantFoot: '', height: '', weight: '', notes: '', signingStatus: 'NOT_SIGNED' as SigningStatus });
  const [saving, setSaving] = useState(false);
  const [dobError, setDobError] = useState<string | null>(null);

  // Validate DD/MM/YYYY format for DOB
  const validateDobInput = (value: string): string | null => {
    if (!value.trim()) return null; // DOB is optional for Add Player
    const formatRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!formatRegex.test(value)) return 'Invalid format. Use DD/MM/YYYY';
    const [dd, mm, yyyy] = value.split('/').map(Number);
    if (mm < 1 || mm > 12) return 'Invalid month (01-12)';
    if (dd < 1 || dd > 31) return 'Invalid day (01-31)';
    if (yyyy < 1990 || yyyy > 2015) return 'Year must be between 1990 and 2015';
    const dateObj = new Date(yyyy, mm - 1, dd);
    if (dateObj.getFullYear() !== yyyy || dateObj.getMonth() !== mm - 1 || dateObj.getDate() !== dd) {
      return 'Invalid date';
    }
    return null;
  };

  // Parse DD/MM/YYYY to ISO YYYY-MM-DD
  const parseDobToISO = (value: string): string => {
    const [dd, mm, yyyy] = value.split('/');
    return `${yyyy}-${mm}-${dd}`;
  };


  // Filter state
  const [nameFilter, setNameFilter] = useState('');
  const [competitionFilter, setCompetitionFilter] = useState<string>('All');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [emailing, setEmailing] = useState(false);

  // Email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailError, setEmailError] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ items: Player[] }>(`/api/players?limit=200`);
      setPlayers(d.items);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Client-side filtering + sort by surname (last word of fullName)
  const filteredPlayers = useMemo(() => {
    let result = players;
    if (competitionFilter !== 'All') {
      result = result.filter((p) => p.competition === competitionFilter);
    }
    if (nameFilter.trim()) {
      const query = nameFilter.trim().toLowerCase();
      result = result.filter((p) => p.fullName.toLowerCase().includes(query));
    }
    // Sort alphabetically by surname (last word in full name)
    return [...result].sort((a, b) => {
      const surnameA = (a.fullName || '').trim().split(/\s+/).pop()?.toLowerCase() || '';
      const surnameB = (b.fullName || '').trim().split(/\s+/).pop()?.toLowerCase() || '';
      return surnameA.localeCompare(surnameB);
    });
  }, [players, competitionFilter, nameFilter]);

  const hasActiveFilters = competitionFilter !== 'All' || nameFilter.trim().length > 0;

  const clearFilters = () => {
    setNameFilter('');
    setCompetitionFilter('All');
  };

  // ─── Selection logic ──────────────────────────────────
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredIds = useMemo(() => filteredPlayers.map((p) => p.id), [filteredPlayers]);

  const allFilteredSelected = filteredPlayers.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedCount = selectedIds.size;

  // ─── Export PDF ───────────────────────────────────────
  const handleExportPdf = async () => {
    if (selectedCount === 0) return;
    setExporting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${api.baseUrl}/api/export/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ playerIds: Array.from(selectedIds) }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      const filename = `scouting_reports_${new Date().toISOString().split('T')[0]}.pdf`;

      if (Platform.OS === 'web') {
        // Web: trigger download via anchor tag
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Native: use expo-file-system + sharing
        try {
          const FileSystem = require('expo-file-system');
          const Sharing = require('expo-sharing');
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const fileUri = FileSystem.documentDirectory + filename;
            await FileSystem.writeAsStringAsync(fileUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(fileUri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Save Scouting Report',
              });
            }
          };
        } catch {
          showAlert('Info', 'PDF generated but sharing is not available on this device.');
        }
      }

      showAlert('Success', `PDF exported for ${selectedCount} player(s).`);
      clearSelection();
    } catch (e: any) {
      showAlert('Export Error', e.message || 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  // ─── Email PDF ────────────────────────────────────────
  const openEmailModal = () => {
    setEmailAddress('');
    setEmailError('');
    setEmailModalOpen(true);
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleEmailSend = async () => {
    const trimmed = emailAddress.trim();
    if (!trimmed) {
      setEmailError('Email address is required');
      return;
    }
    if (!validateEmail(trimmed)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailing(true);
    setEmailError('');
    try {
      const result = await api.post<{ success: boolean; message: string }>('/api/export/players/email', {
        playerIds: Array.from(selectedIds),
        email: trimmed,
      });
      setEmailModalOpen(false);
      showAlert('Success', result.message || `Reports sent to ${trimmed}`);
      clearSelection();
    } catch (e: any) {
      setEmailError(e.message || 'Failed to send email');
    } finally {
      setEmailing(false);
    }
  };

  // ─── Add / Delete Player ─────────────────────────────
  const addPlayer = async () => {
    if (!form.fullName.trim()) return showAlert('Error', 'Name is required');
    // Validate DOB if provided
    if (form.dateOfBirth.trim()) {
      const dobValidation = validateDobInput(form.dateOfBirth);
      if (dobValidation) {
        setDobError(dobValidation);
        return;
      }
    }
    setDobError(null);
    try {
      setSaving(true);
      const dobISO = form.dateOfBirth.trim() ? parseDobToISO(form.dateOfBirth) : undefined;
      await api.post('/api/players', {
        fullName: form.fullName,
        team: form.team || undefined,
        dateOfBirth: dobISO,
        draftYear: form.draftYear ? parseInt(form.draftYear) : undefined,
        competition: form.competition || undefined,
        dominantFoot: form.dominantFoot || undefined,
        height: form.height ? parseFloat(form.height) : undefined,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        notes: form.notes || undefined,
        signingStatus: form.signingStatus,
      });
      setModalOpen(false);
      setForm({ fullName: '', team: '', dateOfBirth: '', draftYear: '', competition: '', dominantFoot: '', height: '', weight: '', notes: '', signingStatus: 'NOT_SIGNED' });
      setDobError(null);
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

  const isAdmin = user?.role === 'ADMIN';

  return (
    <View style={styles.container}>
      {/* Filters Section */}
      <View style={styles.filtersContainer}>
        {/* Name search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            value={nameFilter}
            onChangeText={setNameFilter}
            placeholder="Search by name..."
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          {nameFilter.length > 0 && (
            <TouchableOpacity onPress={() => setNameFilter('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Competition filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipScrollContent}>
          {COMPETITION_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setCompetitionFilter(c)}
              style={[styles.filterChip, competitionFilter === c && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, competitionFilter === c && styles.filterChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Results count & clear */}
        <View style={styles.resultsRow}>
          <Text style={styles.resultsText}>
            Showing {filteredPlayers.length} of {players.length} players
          </Text>
          {hasActiveFilters && (
            <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
              <Ionicons name="close-circle-outline" size={14} color={Colors.accent} />
              <Text style={styles.clearBtnText}>Clear filters</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalOpen(true)}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Select All & Selection Info (admin only) */}
        {isAdmin && filteredPlayers.length > 0 && (
          <View style={styles.selectionRow}>
            <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn}>
              <Ionicons
                name={allFilteredSelected ? 'checkbox' : 'square-outline'}
                size={22}
                color={allFilteredSelected ? Colors.accent : Colors.textMuted}
              />
              <Text style={styles.selectAllText}>Select All</Text>
            </TouchableOpacity>

            {selectedCount > 0 && (
              <View style={styles.selectionInfo}>
                <Text style={styles.selectedCountText}>
                  {selectedCount} selected
                </Text>
                <TouchableOpacity onPress={clearSelection} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons (show only when players are selected) */}
        {isAdmin && selectedCount > 0 && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.exportBtn, exporting && styles.actionBtnDisabled]}
              onPress={handleExportPdf}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="document-outline" size={18} color="#fff" />
              )}
              <Text style={styles.actionBtnText}>
                {exporting ? 'Generating...' : 'Export PDF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.emailBtn, emailing && styles.actionBtnDisabled]}
              onPress={openEmailModal}
              disabled={emailing}
            >
              <Ionicons name="mail-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Email PDF</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={filteredPlayers}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        ListEmptyComponent={
          hasActiveFilters
            ? <EmptyState icon="filter-outline" message="No players match your filters" actionLabel="Clear Filters" onAction={clearFilters} />
            : <EmptyState icon="people-outline" message="No players found" actionLabel="Add Player" onAction={() => setModalOpen(true)} />
        }
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <Card
              onPress={() => router.push(`/player/${item.id}`)}
              style={[styles.playerCard, isSelected && styles.playerCardSelected]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* Checkbox (admin only) */}
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => toggleSelection(item.id)}
                    style={styles.checkbox}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={isSelected ? Colors.accent : Colors.textMuted}
                    />
                  </TouchableOpacity>
                )}

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.name}>{item.fullName}</Text>
                    {item.signingStatus === 'SIGNED' && (
                      <View style={styles.signingBadgeSigned}>
                        <Ionicons name="checkmark-circle" size={12} color="#fff" />
                        <Text style={styles.signingBadgeText}>Signed</Text>
                      </View>
                    )}
                    {item.signingStatus === 'NOT_SIGNED' && (
                      <View style={styles.signingBadgeNotSigned}>
                        <Ionicons name="remove-circle" size={12} color="#fff" />
                        <Text style={styles.signingBadgeText}>Not Signed</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.meta}>
                    {[item.team, item.competition, item.age != null ? (item.draftYear ? `${item.age}yo | ${item.draftYear} Draft` : `${item.age}yo`) : (item.draftYear ? `${item.draftYear} Draft` : null)].filter(Boolean).join(' • ')}
                  </Text>
                </View>
                {isAdmin && (
                  <TouchableOpacity onPress={() => deletePlayer(item.id, item.fullName)}>
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          );
        }}
      />

      {/* Add Player Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <ScrollView>
              <Text style={styles.modalTitle}>Add Player</Text>
              <Input label="Full Name *" value={form.fullName} onChangeText={(t) => setForm({ ...form, fullName: t })} />
              <Input label="Team" value={form.team} onChangeText={(t) => setForm({ ...form, team: t })} />
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Date of Birth</Text>
                <TextInput
                  style={[styles.dobInput, dobError ? styles.dobInputError : null]}
                  value={form.dateOfBirth}
                  onChangeText={(t) => { setForm({ ...form, dateOfBirth: t }); if (dobError) setDobError(null); }}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                />
                {dobError ? <Text style={styles.dobErrorText}>{dobError}</Text> : null}
              </View>
              <Input label="Draft Year" value={form.draftYear} onChangeText={(t) => setForm({ ...form, draftYear: t })} keyboardType="numeric" placeholder="e.g. 2026" />
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
              <Text style={{ color: Colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 4 }}>Signing Status</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {SIGNING_STATUSES.map((s) => (
                  <TouchableOpacity key={s} onPress={() => setForm({ ...form, signingStatus: s })}
                    style={[styles.chip, form.signingStatus === s && (s === 'SIGNED' ? styles.chipSigned : styles.chipNotSigned)]}>
                    <Text style={[styles.chipText, form.signingStatus === s && { color: '#fff' }]}>{SIGNING_STATUS_LABELS[s]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Input label="Notes" value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} multiline />
              <GradientButton title="Save" onPress={addPlayer} loading={saving} />
              <TouchableOpacity onPress={() => setModalOpen(false)} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ color: Colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Email Modal */}
      <Modal visible={emailModalOpen} animationType="fade" transparent>
        <View style={styles.emailModalOverlay}>
          <View style={styles.emailModal}>
            <Text style={styles.emailModalTitle}>Email Scouting Reports</Text>
            <Text style={styles.emailModalSubtitle}>
              Send PDF reports for {selectedCount} player(s) to:
            </Text>

            <TextInput
              value={emailAddress}
              onChangeText={(t) => {
                setEmailAddress(t);
                if (emailError) setEmailError('');
              }}
              placeholder="recipient@example.com"
              placeholderTextColor={Colors.textMuted}
              style={[styles.emailInput, emailError ? styles.emailInputError : null]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!emailing}
            />
            {emailError ? <Text style={styles.emailErrorText}>{emailError}</Text> : null}

            <View style={styles.emailModalActions}>
              <TouchableOpacity
                onPress={() => setEmailModalOpen(false)}
                style={styles.emailCancelBtn}
                disabled={emailing}
              >
                <Text style={styles.emailCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.emailSendBtn, emailing && styles.actionBtnDisabled]}
                onPress={handleEmailSend}
                disabled={emailing}
              >
                {emailing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={16} color="#fff" />
                )}
                <Text style={styles.emailSendText}>
                  {emailing ? 'Sending...' : 'Send'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  filtersContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.elevated, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 10, marginLeft: 8 },
  chipScroll: { marginTop: 10 },
  chipScrollContent: { gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  resultsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  resultsText: { color: Colors.textMuted, fontSize: 12, flex: 1 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearBtnText: { color: Colors.accent, fontSize: 12, fontWeight: '600' },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 10, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  playerCard: { marginBottom: 10 },
  playerCardSelected: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text },
  meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },

  // Selection
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingVertical: 6,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedCountText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  checkbox: {
    marginRight: 12,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  exportBtn: {
    backgroundColor: Colors.primary,
  },
  emailBtn: {
    backgroundColor: Colors.accent,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Email modal
  emailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emailModal: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  emailModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  emailModalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  emailInput: {
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },
  emailInputError: {
    borderColor: Colors.error,
  },
  emailErrorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 6,
  },
  emailModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  emailCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
  },
  emailCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  emailSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  emailSendText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Modals (existing)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 16, textAlign: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipSigned: { backgroundColor: Colors.green, borderColor: Colors.green },
  chipNotSigned: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },

  // Signing status badges on player cards
  signingBadgeSigned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.green,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  signingBadgeNotSigned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.orange,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  signingBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  dobInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
    color: Colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dobInputError: {
    borderColor: Colors.error || '#ef4444',
  },
  dobErrorText: {
    color: Colors.error || '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
});