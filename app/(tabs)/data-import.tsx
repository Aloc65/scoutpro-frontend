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

export default function DataImportScreen() {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const hasResultErrors = useMemo(() => (result?.errors?.length || 0) > 0, [result]);

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
      showAlert('No File Selected', 'Please select a Champion Data CSV/XLSX file first.');
      return;
    }

    try {
      setUploading(true);
      const uploadFile = await buildUploadFile(selectedFile);
      const response = await api.upload<ImportResponse>('/api/champion-data/import', uploadFile);
      setResult(response);
      showAlert('Import Complete', 'Champion Data import completed successfully.');
    } catch (e: any) {
      showAlert('Import Failed', e.message || 'Failed to import Champion Data file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Ionicons name="cloud-upload-outline" size={40} color={Colors.accent} style={{ alignSelf: 'center' }} />
        <Text style={styles.title}>Data Import</Text>
        <Text style={styles.subtitle}>Upload Champion Data benchmark/match files (CSV/XLSX). This tab is designed for future data source imports too.</Text>

        <TouchableOpacity style={styles.filePicker} activeOpacity={0.8} onPress={pickFile}>
          <Ionicons name="document-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.filePickerText}>{selectedFile ? selectedFile.name : 'Select Champion Data file'}</Text>
        </TouchableOpacity>

        <GradientButton title="Import Champion Data" onPress={runImport} loading={uploading} style={{ marginTop: 14 }} />

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
