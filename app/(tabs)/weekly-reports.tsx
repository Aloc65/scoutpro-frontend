import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api/client';
import { Colors } from '../../src/theme/colors';
import GradientButton from '../../src/components/GradientButton';
import Card from '../../src/components/Card';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../src/utils/alert';

/* ────────────────────── Types ────────────────────── */

interface Recipient {
  name: string;
  email: string;
  role: string;
}

interface ReportSummary {
  id: string;
  playerName: string;
  scoutName: string;
  createdAt: string;
  overallProjection: string;
}

interface PreviewData {
  success: boolean;
  period: { start: string; end: string };
  reportCount: number;
  recipients: Recipient[];
  summary: {
    totalReports: number;
    uniquePlayers: number;
    activeScouts: string[];
    competitions: string[];
    strongProspects: number;
    watchPlayers: number;
  };
  reports: ReportSummary[];
}

interface HistoryCampaign {
  campaignId: string;
  triggeredBy: string;
  periodStart: string;
  periodEnd: string;
  reportCount: number;
  createdAt: string;
  recipients: { email: string; name: string; status: string; error: string | null }[];
  totals: { sent: number; failed: number };
}

/* ────────────────────── Component ────────────────── */

export default function WeeklyReportsScreen() {
  const { user } = useAuth();

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [history, setHistory] = useState<HistoryCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [daysBack, setDaysBack] = useState(7);
  const [activeTab, setActiveTab] = useState<'download' | 'history'>('download');

  /* ── Data fetching ── */

  const fetchData = useCallback(async () => {
    try {
      const [previewRes, historyRes] = await Promise.all([
        api.get<PreviewData>(`/api/weekly-reports/preview?daysBack=${daysBack}`),
        api.get<{ success: boolean; campaigns: HistoryCampaign[] }>('/api/weekly-reports/history?limit=20'),
      ]);
      setPreview(previewRes);
      setHistory(historyRes.campaigns || []);
    } catch (e: any) {
      console.error('Weekly reports fetch error:', e);
      showAlert('Error', e.message || 'Failed to load weekly reports data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [daysBack]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      setLoading(true);
      fetchData();
    }
  }, [fetchData, user?.role]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  /* ── Download PDF ── */

  const handleDownload = async () => {
    if (!preview || preview.reportCount === 0) {
      showAlert('No Reports', 'There are no reports for the selected period. Nothing to download.');
      return;
    }

    try {
      setDownloading(true);

      if (Platform.OS === 'web') {
        // Web: fetch as blob and trigger browser download
        const token = await (await import('../../src/api/client')).getToken();
        const baseUrl = api.baseUrl;
        const response = await fetch(`${baseUrl}/api/weekly-reports/download?daysBack=${daysBack}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ message: 'Download failed' }));
          throw new Error(err.message || `Download failed: ${response.status}`);
        }

        const blob = await response.blob();
        const filename = response.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1]
          || `FFS_Weekly_Reports.pdf`;

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showAlert(
          'Download Complete',
          `PDF downloaded: ${filename}\n\n${preview.reportCount} reports included.\n\nYou can now attach this to your email and send it to your team.`,
        );
      } else {
        // Native: would use expo-sharing / expo-file-system
        showAlert('Download', 'PDF download is available on the web version. Open ScoutPro in your browser to download.');
      }
    } catch (e: any) {
      showAlert('Download Failed', e.message || 'Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  /* ── Non-admin gate ── */

  if (user?.role !== 'ADMIN') {
    return (
      <View style={styles.container}>
        <Card style={styles.msgCard}>
          <Ionicons name="lock-closed" size={48} color={Colors.textMuted} />
          <Text style={styles.msgTitle}>Admin Only</Text>
          <Text style={styles.msgSub}>Weekly report distribution is restricted to administrators.</Text>
        </Card>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading weekly reports...</Text>
      </View>
    );
  }

  /* ── Main render ── */

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="download-outline" size={28} color={Colors.primary} />
        <Text style={styles.headerTitle}>Weekly Reports</Text>
      </View>
      <Text style={styles.headerSub}>
        Download your weekly scouting report package as a PDF, then email it to your team.
      </Text>

      {/* How-to banner */}
      <Card style={styles.howToCard}>
        <View style={styles.howToRow}>
          <Ionicons name="information-circle" size={20} color={Colors.accent} />
          <Text style={styles.howToTitle}>How it works</Text>
        </View>
        <Text style={styles.howToStep}>1. Select your reporting period below</Text>
        <Text style={styles.howToStep}>2. Review the summary of included reports</Text>
        <Text style={styles.howToStep}>3. Tap <Text style={styles.howToBold}>Run Weekly Report</Text> to generate &amp; download the full report package</Text>
        <Text style={styles.howToStep}>4. Attach the PDF to your email and send to your scouts</Text>
      </Card>

      {/* Tab selector */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'download' && styles.tabActive]}
          onPress={() => setActiveTab('download')}
        >
          <Ionicons name="download-outline" size={16} color={activeTab === 'download' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'download' && styles.tabTextActive]}>Download</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons name="time-outline" size={16} color={activeTab === 'history' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Send History</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'download' ? renderDownloadTab() : renderHistoryTab()}
    </ScrollView>
  );

  /* ──────────────── Download Tab ──────────────── */

  function renderDownloadTab() {
    return (
      <View>
        {/* Period selector */}
        <Card style={styles.periodCard}>
          <Text style={styles.sectionTitle}>Report Period</Text>
          <View style={styles.periodRow}>
            {[7, 14, 30].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.periodBtn, daysBack === d && styles.periodBtnActive]}
                onPress={() => setDaysBack(d)}
              >
                <Text style={[styles.periodBtnText, daysBack === d && styles.periodBtnTextActive]}>
                  {d === 7 ? 'Last 7 days' : d === 14 ? 'Last 14 days' : 'Last 30 days'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {preview && (
            <Text style={styles.periodRange}>
              {preview.period.start} → {preview.period.end}
            </Text>
          )}
        </Card>

        {/* Summary Stats */}
        {preview && (
          <Card style={styles.statsCard}>
            <Text style={styles.sectionTitle}>What's Included</Text>
            <View style={styles.statsGrid}>
              <StatBox label="Reports" value={preview.summary.totalReports} icon="document-text" color={Colors.primary} />
              <StatBox label="Players" value={preview.summary.uniquePlayers} icon="people" color={Colors.accent} />
              <StatBox label="Scouts" value={preview.summary.activeScouts?.length ?? 0} icon="person" color={Colors.green} />
              <StatBox label="Strong" value={preview.summary.strongProspects} icon="trending-up" color={Colors.green} />
              <StatBox label="Watch" value={preview.summary.watchPlayers} icon="eye" color={Colors.orange} />
              <StatBox label="Competitions" value={preview.summary.competitions?.length ?? 0} icon="trophy" color={Colors.amber} />
            </View>
          </Card>
        )}

        {/* Reports list preview */}
        {preview && preview.reports.length > 0 && (
          <Card style={styles.reportsPreviewCard}>
            <Text style={styles.sectionTitle}>Reports ({preview.reports.length})</Text>
            {preview.reports.slice(0, 10).map((r, i) => (
              <View key={i} style={styles.reportRow}>
                <View style={styles.reportInfo}>
                  <Text style={styles.reportPlayer}>{r.playerName}</Text>
                  <Text style={styles.reportScout}>by {r.scoutName}</Text>
                </View>
              </View>
            ))}
            {preview.reports.length > 10 && (
              <Text style={styles.moreText}>+{preview.reports.length - 10} more reports...</Text>
            )}
          </Card>
        )}

        {/* PDF Contents description */}
        <Card style={styles.contentsCard}>
          <Text style={styles.sectionTitle}>PDF Contains</Text>
          <View style={styles.contentItem}>
            <Ionicons name="image-outline" size={16} color={Colors.accent} />
            <Text style={styles.contentText}>Professional cover page with FFS Scouting branding</Text>
          </View>
          <View style={styles.contentItem}>
            <Ionicons name="list-outline" size={16} color={Colors.accent} />
            <Text style={styles.contentText}>Table of contents with all players</Text>
          </View>
          <View style={styles.contentItem}>
            <Ionicons name="stats-chart-outline" size={16} color={Colors.accent} />
            <Text style={styles.contentText}>Summary page with stats, scouts & player snapshot table</Text>
          </View>
          <View style={styles.contentItem}>
            <Ionicons name="document-text-outline" size={16} color={Colors.accent} />
            <Text style={styles.contentText}>Full individual report for each player with ratings & stats</Text>
          </View>
        </Card>

        {/* Recipients reference */}
        {preview && preview.recipients.length > 0 && (
          <Card style={styles.recipientsCard}>
            <Text style={styles.sectionTitle}>
              Email Recipients Reference ({preview.recipients.length})
            </Text>
            <Text style={styles.recipientsHint}>Send the downloaded PDF to these team members:</Text>
            {preview.recipients.map((r, i) => (
              <View key={i} style={styles.recipientRow}>
                <Ionicons name="person-circle-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.recipientName}>{r.name}</Text>
                <Text style={styles.recipientEmail}>{r.email}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Download Button — PRIMARY ACTION */}
        <View style={styles.downloadSection}>
          <GradientButton
            title={downloading ? 'Generating Report…' : 'RUN WEEKLY REPORT'}
            onPress={handleDownload}
            loading={downloading}
            disabled={downloading || !preview || preview.reportCount === 0}
            icon="download-outline"
          />
          {preview && preview.reportCount > 0 && (
            <Text style={styles.downloadHint}>
              📎 {preview.reportCount} report{preview.reportCount !== 1 ? 's' : ''} • Download then attach to your email
            </Text>
          )}
          {preview?.reportCount === 0 && (
            <Text style={styles.noReportsWarn}>
              ⚠️ No reports found for the last {daysBack} days. Try a longer period.
            </Text>
          )}
        </View>
      </View>
    );
  }

  /* ──────────────── History Tab ──────────────── */

  function renderHistoryTab() {
    if (history.length === 0) {
      return (
        <Card style={styles.emptyCard}>
          <Ionicons name="file-tray-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Send History</Text>
          <Text style={styles.emptySub}>
            Previously sent email campaigns will appear here for reference.
          </Text>
        </Card>
      );
    }

    return (
      <View>
        {history.map((c, idx) => (
          <Card key={idx} style={styles.campaignCard}>
            <View style={styles.campaignHeader}>
              <Text style={styles.campaignDate}>
                {new Date(c.createdAt).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <View style={styles.campaignBadge}>
                <Text style={styles.campaignBadgeText}>{c.reportCount} reports</Text>
              </View>
            </View>
            <Text style={styles.campaignPeriod}>
              Period: {c.periodStart} → {c.periodEnd}
            </Text>
            <View style={styles.campaignEntries}>
              {c.recipients.map((r, i) => (
                <View key={i} style={styles.entryRow}>
                  <Ionicons
                    name={r.status === 'sent' ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={r.status === 'sent' ? Colors.green : Colors.error}
                  />
                  <Text style={styles.entryName}>{r.name}</Text>
                  <Text style={[styles.entryStatus, { color: r.status === 'sent' ? Colors.green : Colors.error }]}>
                    {r.status}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ))}
      </View>
    );
  }
}

/* ────────────────── Stat Box ────────────────── */

function StatBox({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <View style={statStyles.box}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

/* ────────────────── Styles ────────────────── */

const statStyles = StyleSheet.create({
  box: { alignItems: 'center', width: '33%', paddingVertical: 8 },
  value: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  label: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 60 },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: Colors.textSecondary, marginTop: 12 },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  headerSub: { color: Colors.textSecondary, fontSize: 13, marginBottom: 16 },

  /* How-to */
  howToCard: { marginBottom: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: Colors.accent },
  howToRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  howToTitle: { color: Colors.accent, fontWeight: '600', fontSize: 14 },
  howToStep: { color: Colors.textSecondary, fontSize: 12, marginBottom: 3, paddingLeft: 4 },
  howToBold: { color: Colors.text, fontWeight: '600' },

  /* Tabs */
  tabs: { flexDirection: 'row', marginBottom: 16, borderRadius: 8, backgroundColor: Colors.elevated, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 6 },
  tabActive: { backgroundColor: Colors.card },
  tabText: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },

  /* Period */
  periodCard: { marginBottom: 12, padding: 14 },
  sectionTitle: { color: Colors.text, fontWeight: '600', fontSize: 15, marginBottom: 10 },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.elevated, alignItems: 'center' },
  periodBtnActive: { backgroundColor: Colors.primary + '33', borderWidth: 1, borderColor: Colors.primary },
  periodBtnText: { color: Colors.textSecondary, fontWeight: '500', fontSize: 12 },
  periodBtnTextActive: { color: Colors.primary },
  periodRange: { color: Colors.textSecondary, fontSize: 12, marginTop: 10, textAlign: 'center' },

  /* Stats */
  statsCard: { marginBottom: 12, padding: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },

  /* Reports preview */
  reportsPreviewCard: { marginBottom: 12, padding: 14 },
  reportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  reportInfo: { flex: 1 },
  reportPlayer: { color: Colors.text, fontWeight: '500', fontSize: 13 },
  reportScout: { color: Colors.textSecondary, fontSize: 11 },
  moreText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 },

  /* PDF Contents */
  contentsCard: { marginBottom: 12, padding: 14 },
  contentItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  contentText: { color: Colors.textSecondary, fontSize: 12, flex: 1 },

  /* Recipients */
  recipientsCard: { marginBottom: 12, padding: 14 },
  recipientsHint: { color: Colors.textSecondary, fontSize: 11, marginBottom: 8 },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },
  recipientName: { color: Colors.text, fontWeight: '500', fontSize: 13, flex: 1 },
  recipientEmail: { color: Colors.textSecondary, fontSize: 11 },

  /* Download */
  downloadSection: { marginTop: 12, marginBottom: 20 },
  downloadHint: { color: Colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 10 },
  noReportsWarn: { color: Colors.amber, fontSize: 12, textAlign: 'center', marginTop: 8 },

  /* Non-admin */
  msgCard: { alignItems: 'center', padding: 32, gap: 12 },
  msgTitle: { color: Colors.text, fontSize: 18, fontWeight: '600' },
  msgSub: { color: Colors.textSecondary, textAlign: 'center' },

  /* Empty history */
  emptyCard: { alignItems: 'center', padding: 32, gap: 12, marginTop: 20 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  emptySub: { color: Colors.textSecondary, textAlign: 'center', fontSize: 13 },

  /* Campaign history cards */
  campaignCard: { marginBottom: 12, padding: 14 },
  campaignHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  campaignDate: { color: Colors.text, fontWeight: '600', fontSize: 14 },
  campaignBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: Colors.primary + '22' },
  campaignBadgeText: { color: Colors.primary, fontSize: 11, fontWeight: '600' },
  campaignPeriod: { color: Colors.textSecondary, fontSize: 12, marginBottom: 8 },
  campaignEntries: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  entryName: { flex: 1, color: Colors.text, fontSize: 13 },
  entryStatus: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' as const },
});
