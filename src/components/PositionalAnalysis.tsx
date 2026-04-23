import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import Card from './Card';
import {
  listPositions,
  comparePlayer,
  uploadBenchmarks,
  ComparisonResponse,
  ComparisonRow,
} from '../api/positionalBenchmarks';

interface Props {
  playerId: string;
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

function resultStyles(result: ComparisonRow['result']) {
  switch (result) {
    case 'above':
      return { color: Colors.green, bg: 'rgba(16,185,129,0.12)', icon: 'arrow-up' as const };
    case 'below':
      return { color: Colors.error, bg: 'rgba(239,68,68,0.12)', icon: 'arrow-down' as const };
    default:
      return { color: Colors.textSecondary, bg: 'rgba(148,148,163,0.12)', icon: 'remove' as const };
  }
}

export default function PositionalAnalysis({ playerId, isAdmin }: Props) {
  const [positions, setPositions] = useState<string[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonResponse | null>(null);
  const [loadingPositions, setLoadingPositions] = useState<boolean>(true);
  const [loadingCompare, setLoadingCompare] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadPositions = useCallback(async () => {
    setLoadingPositions(true);
    try {
      const list = await listPositions();
      setPositions(list ?? []);
    } finally {
      setLoadingPositions(false);
    }
  }, []);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const loadComparison = useCallback(
    async (positionName: string) => {
      if (!playerId || !positionName) return;
      setLoadingCompare(true);
      setErrorMsg(null);
      setComparisonData(null);
      try {
        const data = await comparePlayer(playerId, positionName);
        setComparisonData(data);
      } catch (e: any) {
        setErrorMsg(e?.message || 'Failed to load comparison');
      } finally {
        setLoadingCompare(false);
      }
    },
    [playerId],
  );

  const onSelectPosition = useCallback(
    (pos: string) => {
      setSelectedPosition(pos);
      loadComparison(pos);
    },
    [loadComparison],
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
        // On web, asset.file is a browser File object
        const webFile = (asset as any).file;
        if (webFile) {
          fileToSend = webFile;
        } else {
          // Fallback: fetch the uri into a blob
          const r = await fetch(asset.uri);
          const blob = await r.blob();
          fileToSend = new File([blob], asset.name ?? 'benchmarks.xlsx', {
            type: asset.mimeType ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
        }
      } else {
        fileToSend = {
          uri: asset.uri,
          name: asset.name ?? 'benchmarks.xlsx',
          type:
            asset.mimeType ??
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }

      const result = await uploadBenchmarks(fileToSend);
      showToast(
        'success',
        `${result?.count ?? 0} position${(result?.count ?? 0) === 1 ? '' : 's'} uploaded`,
      );
      await loadPositions();
      // If currently selected position was replaced, re-fetch comparison
      if (selectedPosition) {
        loadComparison(selectedPosition);
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
  }, [loadComparison, loadPositions, selectedPosition, showToast]);

  const renderUploadButton = () => (
    <TouchableOpacity
      style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
      onPress={onUpload}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel="Upload positional benchmarks"
    >
      {uploading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
      )}
      <Text style={styles.uploadBtnText}>
        {uploading ? 'Uploading…' : 'Upload Positional Benchmarks'}
      </Text>
    </TouchableOpacity>
  );

  const renderPositionChips = () => {
    if (!positions?.length) return null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {positions.map((p) => {
          const active = selectedPosition === p;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => onSelectPosition(p)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityLabel={`Select position ${p}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
            onPress={() => selectedPosition && loadComparison(selectedPosition)}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!selectedPosition) {
      return (
        <View style={styles.emptyWrap}>
          <Ionicons name="options-outline" size={28} color={Colors.textMuted} />
          <Text style={styles.mutedText}>Select a position to view analysis</Text>
        </View>
      );
    }
    if (!comparisonData) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.mutedText}>No comparison data available</Text>
        </View>
      );
    }
    const rows = comparisonData.comparisons ?? [];
    if (rows.length === 0 || (comparisonData.matchedStatsCount ?? 0) === 0) {
      return (
        <View style={styles.emptyWrap}>
          <Ionicons name="stats-chart-outline" size={28} color={Colors.textMuted} />
          <Text style={styles.mutedText}>
            No matching stats found between player data and selected position
          </Text>
        </View>
      );
    }

    return (
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={styles.table}>
            <View style={[styles.row, styles.headerRow]}>
              <View style={[styles.cellStat, styles.headerCell]}>
                <Text style={styles.headerText}>Stat</Text>
              </View>
              <View style={[styles.cellNum, styles.headerCell]}>
                <Text style={styles.headerText}>Player</Text>
              </View>
              <View style={[styles.cellNum, styles.headerCell]}>
                <Text style={styles.headerText}>Position Avg</Text>
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
                    <Text style={styles.cellText}>{fmt(r?.playerValue)}</Text>
                  </View>
                  <View style={styles.cellNum}>
                    <Text style={styles.cellText}>{fmt(r?.positionAverage)}</Text>
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

        {!!comparisonData?.analysis && (
          <View style={styles.analysisCard}>
            <View style={styles.analysisHeader}>
              <Text style={styles.analysisEmoji}>📊</Text>
              <Text style={styles.analysisTitle}>Analysis Summary</Text>
            </View>
            <Text style={styles.analysisText}>{comparisonData.analysis}</Text>
            <Text style={styles.analysisMeta}>
              Matched stats: {comparisonData?.matchedStatsCount ?? 0}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Card style={{ marginBottom: 16 }}>
      <View style={styles.headerRowTop}>
        <Text style={styles.sectionTitle}>Positional Analysis</Text>
        {isAdmin && positions.length > 0 && renderUploadButton()}
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

      {loadingPositions ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.mutedText}>Loading positions…</Text>
        </View>
      ) : positions.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="folder-open-outline" size={28} color={Colors.textMuted} />
          <Text style={styles.mutedText}>
            No positional benchmarks available.
            {isAdmin ? ' Please upload benchmark data.' : ''}
          </Text>
          {isAdmin && <View style={{ marginTop: 12 }}>{renderUploadButton()}</View>}
        </View>
      ) : (
        <>
          <Text style={styles.subLabel}>Select a position</Text>
          {renderPositionChips()}
          <View style={{ height: 12 }} />
          {renderTable()}
        </>
      )}
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
  chipsRow: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
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
    minWidth: 420,
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
    width: 90,
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
  analysisTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
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
});
