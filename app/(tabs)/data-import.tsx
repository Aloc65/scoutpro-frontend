import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api/client';
import { Colors } from '../../src/theme/colors';
import Card from '../../src/components/Card';
import GradientButton from '../../src/components/GradientButton';
import { showAlert } from '../../src/utils/alert';

type ImportSummary = {
  sourceFile: string;
  sourceSheet: string | null;
  totalRows: number;
  matchedPlayers: number;
  unmatchedPlayers: number;
  created: number;
  updated: number;
  skipped: number;
};

type ImportResponse = {
  success: boolean;
  summary: ImportSummary;
  unmatchedPlayerNames: string[];
  errors: string[];
};

type DataSource = 'champion-data' | 'national-championships';

const DATA_SOURCES: Array<{ key: DataSource; label: string; icon: string; endpoint: string; color: string }> = [
  { key: 'champion-data', label: 'Champion Data', icon: 'trophy-outline', endpoint: '/api/champion-data/import', color: '#06B6D4' },
  { key: 'national-championships', label: 'National Championships', icon: 'flag-outline', endpoint: '/api/national-championships/import', color: '#F59E0B' },
];

// States/Territories used to resolve the competition grade for generic/ambiguous
// filenames (e.g. "u18-2026.xlsx"). Optional — a descriptive filename
// (e.g. "vic-u18-2026.xlsx" or "sanfl-league-2026.xlsx") is detected automatically.
const STATES: Array<{ code: string; label: string }> = [
  { code: 'WA', label: 'WA' },
  { code: 'SA', label: 'SA' },
  { code: 'VIC', label: 'VIC' },
  { code: 'NSW', label: 'NSW' },
  { code: 'QLD', label: 'QLD' },
  { code: 'TAS', label: 'TAS' },
  { code: 'ACT', label: 'ACT' },
  { code: 'NT', label: 'NT' },
];

export default function DataImportScreen() {
  const { user } = useAuth();
  const [activeSource, setActiveSource] = useState<DataSource>('champion-data');
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const hasResultErrors = useMemo(() => (result?.errors?.length || 0) > 0, [result]);
  const currentSource = DATA_SOURCES.find((s) => s.key === activeSource)!;

  if (user?.role !== 'ADMIN') {
    return (
      <View style={styles.container}>
        <Card style={styles.msgCard}>
          <Ionicons name="lock-closed" size={48} color={Colors.textMuted} />
          <Text style={styles.msgTitle}>Admin Only</Text>
          <Text style={styles.msgSub}>Data import is restricted to administrators.</Text>
        </Card>
      </View>
    );
  }

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (res.canceled) return;

    setSelectedFile(res.assets[0]);
    setResult(null);
  };

  const buildUploadFile = async (asset: DocumentPicker.DocumentPickerAsset): Promise<any> => {
    if (Platform.OS === 'web') {
      const fetched = await fetch(asset.uri);
      const blob = await fetched.blob();
      return new File([blob], asset.name, {
        type: asset.mimeType || blob.type || 'application/octet-stream',
      });
    }

    return {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType || 'application/octet-stream',
    };
  };

  const runImport = async () => {
    if (!selectedFile) {
      showAlert('No File Selected', `Please select a ${currentSource.label} CSV/XLSX file first.`);
      return;
    }

    try {
      setUploading(true);
      const uploadFile = await buildUploadFile(selectedFile);
      const fields = selectedState ? { state: selectedState } : undefined;
      const response = await api.upload<ImportResponse>(currentSource.endpoint, uploadFile, fields);
      setResult(response);
      showAlert('Import Complete', `${currentSource.label} import completed successfully.`);
    } catch (e: any) {
      showAlert('Import Failed', e.message || `Failed to import ${currentSource.label} file`);
    } finally {
      setUploading(false);
    }
  };

  const handleSourceChange = (source: DataSource) => {
    setActiveSource(source);
    setSelectedFile(null);
    setSelectedState(null);
    setResult(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Data Source Tabs */}
      <View style={styles.sourceTabs}>
        {DATA_SOURCES.map((source) => (
          <TouchableOpacity
            key={source.key}
            style={[styles.sourceTab, activeSource === source.key && { borderColor: source.color, backgroundColor: `${source.color}18` }]}
            onPress={() => handleSourceChange(source.key)}
          >
            <Ionicons name={source.icon as any} size={16} color={activeSource === source.key ? source.color : Colors.textMuted} />
            <Text style={[styles.sourceTabText, activeSource === source.key && { color: source.color }]}>{source.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card style={styles.card}>
        <Ionicons name="cloud-upload-outline" size={40} color={currentSource.color} style={{ alignSelf: 'center' }} />
        <Text style={styles.title}>Data Import</Text>
        <Text style={styles.subtitle}>Upload {currentSource.label} benchmark/match files (CSV/XLSX).</Text>

        <TouchableOpacity style={styles.filePicker} activeOpacity={0.8} onPress={pickFile}>
          <Ionicons name="document-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.filePickerText}>{selectedFile ? selectedFile.name : `Select ${currentSource.label} file`}</Text>
        </TouchableOpacity>

        {activeSource === 'champion-data' && (
          <View style={styles.stateBlock}>
            <Text style={styles.stateLabel}>State / Territory <Text style={styles.stateOptional}>(optional)</Text></Text>
            <Text style={styles.stateHint}>
              Select the state for generic filenames like “u18-2026.xlsx”. The correct competition (e.g. VIC → Talent League,
              SA → SANFL U18s) will be applied. Skip this if your filename already names the competition.
            </Text>
            <View style={styles.stateGrid}>
              {STATES.map((s) => {
                const active = selectedState === s.code;
                return (
                  <TouchableOpacity
                    key={s.code}
                    style={[styles.statePill, active && { borderColor: currentSource.color, backgroundColor: `${currentSource.color}18` }]}
                    onPress={() => setSelectedState(active ? null : s.code)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.statePillText, active && { color: currentSource.color }]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <GradientButton title={`Import ${currentSource.label}`} onPress={runImport} loading={uploading} style={{ marginTop: 14 }} />

        {uploading && (
          <View style={styles.progressRow}>
            <ActivityIndicator color={Colors.accent} size="small" />
            <Text style={styles.progressText}>Import in progress...</Text>
          </View>
        )}
      </Card>

      {result && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Import Summary</Text>
          <Text style={styles.kv}>File: <Text style={styles.kvValue}>{result.summary.sourceFile}</Text></Text>
          <Text style={styles.kv}>Sheet: <Text style={styles.kvValue}>{result.summary.sourceSheet || 'N/A'}</Text></Text>
          <Text style={styles.kv}>Rows: <Text style={styles.kvValue}>{result.summary.totalRows}</Text></Text>
          <Text style={styles.kv}>Matched Players: <Text style={styles.kvValue}>{result.summary.matchedPlayers}</Text></Text>
          <Text style={styles.kv}>Unmatched Players: <Text style={styles.kvValue}>{result.summary.unmatchedPlayers}</Text></Text>
          <Text style={styles.kv}>Created: <Text style={styles.kvValue}>{result.summary.created}</Text></Text>
          <Text style={styles.kv}>Updated: <Text style={styles.kvValue}>{result.summary.updated}</Text></Text>
          <Text style={styles.kv}>Skipped: <Text style={styles.kvValue}>{result.summary.skipped}</Text></Text>

          {result.unmatchedPlayerNames.length > 0 && (
            <View style={styles.listBlock}>
              <Text style={styles.listTitle}>Unmatched Names ({result.unmatchedPlayerNames.length})</Text>
              {result.unmatchedPlayerNames.slice(0, 25).map((name) => (
                <Text key={name} style={styles.listItem}>• {name}</Text>
              ))}
              {result.unmatchedPlayerNames.length > 25 && (
                <Text style={styles.listItem}>• +{result.unmatchedPlayerNames.length - 25} more</Text>
              )}
            </View>
          )}

          {hasResultErrors && (
            <View style={styles.listBlock}>
              <Text style={[styles.listTitle, { color: Colors.error }]}>Errors ({result.errors.length})</Text>
              {result.errors.slice(0, 20).map((error, idx) => (
                <Text key={`${idx}-${error}`} style={[styles.listItem, { color: Colors.error }]}>• {error}</Text>
              ))}
            </View>
          )}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 32 },
  sourceTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  sourceTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  sourceTabText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  card: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center', marginTop: 10 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  filePicker: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filePickerText: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  stateBlock: { marginTop: 16 },
  stateLabel: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  stateOptional: { color: Colors.textMuted, fontSize: 12, fontWeight: '500' },
  stateHint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 10 },
  stateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.elevated,
  },
  statePillText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  progressText: { color: Colors.textSecondary, fontSize: 13 },
  kv: { color: Colors.textSecondary, fontSize: 14, marginBottom: 4 },
  kvValue: { color: Colors.text, fontWeight: '700' },
  listBlock: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  listTitle: { color: Colors.text, fontWeight: '700', marginBottom: 6 },
  listItem: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  msgCard: { alignItems: 'center', padding: 32, margin: 16 },
  msgTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginTop: 16 },
  msgSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
});
