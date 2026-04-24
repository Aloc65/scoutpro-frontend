import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import Card from './Card';
import {
  listAflPlayers,
  compareWithAflPlayer,
  uploadAflPlayerBenchmarks,
  AflPlayerBenchmark,
  AflPlayerComparisonResponse,
  AflPlayerComparisonRow,
} from '../api/aflPlayerBenchmarks';

interface Props {
  playerId: string;
  playerName: string;
  isAdmin: boolean;
}

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n as number)) return '—';
  return (n as number).toFixed(1);
}

function fmtDiff(n: number | null | undefined): string {
  if (n == null || isNaN(n as number)) return '—';
  const v = n as number;
  const s = v.toFixed(1);
  return v > 0 ? `+${s}` : s;
}

function resultStyles(result: AflPlayerComparisonRow['result']) {
  switch (result) {
    case 'above':
      return { color: Colors.green, bg: 'rgba(16,185,129,0.12)', icon: 'arrow-up' as const };
    case 'below':
      return { color: Colors.error, bg: 'rgba(239,68,68,0.12)', icon: 'arrow-down' as const };
    default:
      return { color: Colors.textSecondary, bg: 'rgba(148,148,163,0.12)', icon: 'remove' as const };
  }
}

function labelFor(p: AflPlayerBenchmark | null): string {
  if (!p) return 'Select an AFL player...';
  return p.team ? `${p.name} (${p.team})` : p.name;
}

export default function AflPlayerComparison({ playerId, playerName, isAdmin }: Props) {
  const [aflPlayers, setAflPlayers] = useState<AflPlayerBenchmark[]>([]);
  const [selectedAflPlayer, setSelectedAflPlayer] = useState<string | null>(null);
  const [data, setData] = useState<AflPlayerComparisonResponse | null>(null);
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingCompare, setLoadingCompare] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadPlayers = useCallback(async () => {
    setLoadingList(true);
    try {
      const list = await listAflPlayers();
      setAflPlayers(list ?? []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const loadComparison = useCallback(
    async (aflName: string) => {
      if (!playerId || !aflName) return;
      setLoadingCompare(true);
      setErrorMsg(null);
      setData(null);
      try {
        const resp = await compareWithAflPlayer(playerId, aflName);
        setData(resp);
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load comparison');
      } finally {
        setLoadingCompare(false);
      }
    },
    [playerId],
  );

  const onSelect = useCallback(
    (aflName: string) => {
      setSelectedAflPlayer(aflName);
      setPickerOpen(false);
      loadComparison(aflName);
    },
    [loadComparison],
  );

  const selectedPlayerObj = useMemo(
    () => aflPlayers.find((p) => p?.name === selectedAflPlayer) ?? null,
    [aflPlayers, selectedAflPlayer],
  );

  const onUpload = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '.xlsx',
          '.xls',
        ],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;

      setUploading(true);
      let fileToSend: any;
      if (Platform.OS === 'web') {
        const webFile = (asset as any).file;
        if (webFile) {
          fileToSend = webFile;
        } else {
          const r = await fetch(asset.uri);
          const blob = await r.blob();
          fileToSend = new File([blob], asset.name ?? 'afl-benchmarks.xlsx', {
            type: asset.mimeType ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
        }
      } else {
        fileToSend = {
          uri: asset.uri,
          name: asset.name ?? 'afl-benchmarks.xlsx',
          type:
            asset.mimeType ??
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }

      const result = await uploadAflPlayerBenchmarks(fileToSend);
      const count = result?.playersUploaded ?? 0;
      showToast(
        'success',
        `${count} AFL player${count === 1 ? '' : 's'} uploaded`,
      );
      await loadPlayers();
      if (selectedAflPlayer) {
        loadComparison(selectedAflPlayer);
      }
    } catch (e: any) {
      const msg = e?.message || 'Upload failed';
      showToast('error', msg);
      if (Platform.OS !== 'web') {
        Alert.alert('Upload failed', msg);
      }
    } finally {
      setUploading(false);
    }
  }, [loadComparison, loadPlayers, selectedAflPlayer, showToast]);

  const renderUploadButton = () => (
    <TouchableOpacity
      style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
      onPress={onUpload}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel="Upload AFL player benchmarks"
    >
      {uploading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
      )}
      <Text style={styles.uploadBtnText}>
        {uploading ? 'Uploading…' : 'Upload AFL Player Benchmarks'}
      </Text>
    </TouchableOpacity>
  );

  const renderSelector = () => {
    if (!aflPlayers?.length) return null;
    return (
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setPickerOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Select AFL player"
      >
        <Ionicons name="trophy-outline" size={16} color={Colors.accent} />
        <Text
          style={[
            styles.selectorText,
            !selectedPlayerObj && { color: Colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {labelFor(selectedPlayerObj)}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderTable = () => {
    if (loadingCompare) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.mutedText}>Loading comparison…</Text>
        </View>
      );
    }
    if (errorMsg) {
      return (
        <View style={styles.emptyWrap}>
          <Ionicons name="alert-circle-outline" size={28} color={Colors.error} />
          <Text style={[styles.mutedText, { color: Colors.error }]}>{errorMsg}</Text>
          <TouchableOpacity
            onPress={() => selectedAflPlayer && loadComparison(selectedAflPlayer)}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!selectedAflPlayer) {
      return (
        <View style={styles.emptyWrap}>
          <Ionicons name="options-outline" size={28} color={Colors.textMuted} />
          <Text style={styles.mutedText}>Select an AFL player to view comparison</Text>
        </View>
      );
    }
    if (!data) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.mutedText}>No comparison data available</Text>
        </View>
      );
    }
    const rows = data.comparisons ?? [];
    if (rows.length === 0 || (data.matchedStatsCount ?? 0) === 0) {
      return (
        <View style={styles.emptyWrap}>
          <Ionicons name="stats-chart-outline" size={28} color={Colors.textMuted} />
          <Text style={styles.mutedText}>
            No matching stats found between player data and {data?.aflPlayerName ?? 'selected AFL player'}
          </Text>
        </View>
      );
    }

    const aflHeaderLabel = data?.aflPlayerName ?? 'AFL Player';

    return (
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={styles.table}>
            <View style={[styles.row, styles.headerRow]}>
              <View style={[styles.cellStat, styles.headerCell]}>
                <Text style={styles.headerText}>Stat</Text>
              </View>
              <View style={[styles.cellNum, styles.headerCell]}>
                <Text style={styles.headerText} numberOfLines={1}>
                  {playerName || 'Your Player'}
                </Text>
              </View>
              <View style={[styles.cellNum, styles.headerCell]}>
                <Text style={styles.headerText} numberOfLines={1}>
                  {aflHeaderLabel}
                </Text>
              </View>
              <View style={[styles.cellNum, styles.headerCell]}>
                <Text style={styles.headerText}>Diff</Text>
              </View>
              <View style={[styles.cellIcon, styles.headerCell]}>
                <Text style={styles.headerText}> </Text>
              </View>
            </View>
            {rows.map((r, idx) => {
              const rs = resultStyles(r?.result ?? 'equal');
              return (
                <View
                  key={`${r?.statName ?? 'row'}-${idx}`}
                  style={[styles.row, { backgroundColor: rs.bg }]}
                >
                  <View style={styles.cellStat}>
                    <Text style={styles.cellText}>{r?.statName ?? '—'}</Text>
                  </View>
                  <View style={styles.cellNum}>
                    <Text style={styles.cellText}>{fmt(r?.scoutingPlayerValue)}</Text>
                  </View>
                  <View style={styles.cellNum}>
                    <Text style={styles.cellText}>{fmt(r?.aflPlayerValue)}</Text>
                  </View>
                  <View style={styles.cellNum}>
                    <Text style={[styles.cellText, { color: rs.color, fontWeight: '700' }]}>
                      {fmtDiff(r?.difference)}
                    </Text>
                  </View>
                  <View style={styles.cellIcon}>
                    <Ionicons name={rs.icon} size={16} color={rs.color} />
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {!!data?.analysis && (
          <View style={styles.analysisCard}>
            <View style={styles.analysisHeader}>
              <Text style={styles.analysisEmoji}>🏆</Text>
              <Text style={styles.analysisTitle}>
                Analysis vs {data?.aflPlayerName ?? 'AFL Player'}
              </Text>
            </View>
            <Text style={styles.analysisText}>{data.analysis}</Text>
            <Text style={styles.analysisMeta}>
              Matched stats: {data?.matchedStatsCount ?? 0}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <View style={styles.headerRowTop}>
        <Text style={styles.sectionTitle}>AFL Player Comparison</Text>
        {isAdmin && aflPlayers.length > 0 && renderUploadButton()}
      </View>

      {toast && (
        <View
          style={[
            styles.toast,
            { backgroundColor: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' },
          ]}
        >
          <Ionicons
            name={toast.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={toast.type === 'success' ? Colors.green : Colors.error}
          />
          <Text
            style={[
              styles.toastText,
              { color: toast.type === 'success' ? Colors.green : Colors.error },
            ]}
          >
            {toast.msg}
          </Text>
        </View>
      )}

      {loadingList ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.mutedText}>Loading AFL players…</Text>
        </View>
      ) : aflPlayers.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="folder-open-outline" size={28} color={Colors.textMuted} />
          <Text style={styles.mutedText}>
            No AFL player benchmarks available.
            {isAdmin ? ' Please upload benchmark data.' : ''}
          </Text>
          {isAdmin && <View style={{ marginTop: 12 }}>{renderUploadButton()}</View>}
        </View>
      ) : (
        <>
          <Text style={styles.subLabel}>Select an AFL player</Text>
          {renderSelector()}
          <View style={{ height: 12 }} />
          {renderTable()}
        </>
      )}

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPickerOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select AFL Player</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={aflPlayers ?? []}
              keyExtractor={(item) => item?.name ?? String(Math.random())}
              ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
              renderItem={({ item }) => {
                const active = item?.name === selectedAflPlayer;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, active && styles.modalItemActive]}
                    onPress={() => onSelect(item?.name ?? '')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalItemText, active && styles.modalItemTextActive]}>
                      {labelFor(item)}
                    </Text>
                    {active && (
                      <Ionicons name="checkmark" size={18} color={Colors.accent} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  subLabel: { color: Colors.textSecondary, fontSize: 13, marginTop: 8, marginBottom: 8 },
  headerRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  uploadBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  selectorText: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 8 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 8 },
  mutedText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryText: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    minWidth: 480,
  },
  row: { flexDirection: 'row' },
  headerRow: { backgroundColor: Colors.elevated },
  headerCell: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  cellStat: {
    width: 160,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  cellNum: {
    width: 110,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  cellIcon: {
    width: 32,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: { color: Colors.text, fontSize: 13 },
  analysisCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  analysisEmoji: { fontSize: 18 },
  analysisTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  analysisText: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  analysisMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 8 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  toastText: { fontSize: 13, fontWeight: '600', flex: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  modalClose: { padding: 4 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalItemActive: { backgroundColor: 'rgba(6,182,212,0.08)' },
  modalItemText: { color: Colors.text, fontSize: 14, fontWeight: '500', flex: 1 },
  modalItemTextActive: { color: Colors.accent, fontWeight: '700' },
  modalSeparator: { height: 1, backgroundColor: Colors.border },
});
