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
import { showAlert, showConfirm } from '../../src/utils/alert';

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
  overallRating: number;
}

interface PreviewData {
  success: boolean;
  period: { start: string; end: string };
  reportCount: number;
  recipients: Recipient[];
  summary: {
    totalReports: number;
    uniquePlayers: number;
    uniqueScouts: number;
    avgRating: number;
    strongProspects: number;
    watchPlayers: number;
  };
  reports: ReportSummary[];
}

interface SmtpStatus {
  success: boolean;
  smtpConfigured: boolean;
  host: string | null;
  from: string | null;
  note: string;
}

interface SendResult {
  success: boolean;
  campaignId: string;
  period: { start: string; end: string };
  reportCount: number;
  results: { email: string; name: string; status: string; error?: string }[];
  totals: { sent: number; failed: number };
  testMode?: boolean;
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
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(null);
  const [history, setHistory] = useState<HistoryCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [daysBack, setDaysBack] = useState(7);
  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview');

  /* ── Data fetching ── */

  const fetchData = useCallback(async () => {
    try {
      const [previewRes, smtpRes, historyRes] = await Promise.all([
        api.get<PreviewData>(`/api/weekly-reports/preview?daysBack=${daysBack}`),
        api.get<SmtpStatus>('/api/weekly-reports/smtp-status'),
        api.get<{ success: boolean; campaigns: HistoryCampaign[] }>('/api/weekly-reports/history?limit=20'),
      ]);
      setPreview(previewRes);
      setSmtpStatus(smtpRes);
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

  /* ── Send emails ── */

  const handleSend = () => {
    if (!preview || preview.reportCount === 0) {
      showAlert('No Reports', 'There are no reports for the selected period. Nothing to send.');
      return;
    }
    showConfirm(
      'Send Weekly Reports',
      `This will send ${preview.reportCount} report(s) to ${preview.recipients.length} recipient(s) for the period ${preview.period.start} – ${preview.period.end}.\n\n${smtpStatus?.smtpConfigured ? '✅ Real SMTP configured — emails will be delivered.' : '⚠️ No SMTP configured — emails will use test mode (not delivered to real inboxes).'}\n\nContinue?`,
      async () => {
        try {
          setSending(true);
          const result = await api.post<SendResult>(`/api/weekly-reports/send?daysBack=${daysBack}`);
          const msg = result.testMode
            ? `Test mode — ${result.totals.sent} email(s) generated but NOT delivered (no real SMTP configured).\n\nCampaign: ${result.campaignId}`
            : `${result.totals.sent} email(s) sent successfully${result.totals.failed > 0 ? `, ${result.totals.failed} failed` : ''}.\n\nCampaign: ${result.campaignId}`;
          showAlert('Send Complete', msg);
          // Refresh history
          fetchData();
        } catch (e: any) {
          showAlert('Send Failed', e.message || 'Failed to send weekly emails');
        } finally {
          setSending(false);
        }
      },
    );
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
        <Ionicons name="mail-outline" size={28} color={Colors.primary} />
        <Text style={styles.headerTitle}>Weekly Report Distribution</Text>
      </View>
      <Text style={styles.headerSub}>
        Manually send the weekly scouting report email to all scouts and admins.
      </Text>

      {/* SMTP Status Banner */}
      {smtpStatus && (
        <Card style={[styles.smtpCard, smtpStatus.smtpConfigured ? styles.smtpOk : styles.smtpWarn]}>
          <View style={styles.smtpRow}>
            <Ionicons
              name={smtpStatus.smtpConfigured ? 'checkmark-circle' : 'warning'}
              size={20}
              color={smtpStatus.smtpConfigured ? Colors.green : Colors.amber}
            />
            <Text style={[styles.smtpText, { color: smtpStatus.smtpConfigured ? Colors.green : Colors.amber }]}>
              {smtpStatus.smtpConfigured ? 'SMTP Configured' : 'No SMTP — Test Mode'}
            </Text>
          </View>
          <Text style={styles.smtpNote}>{smtpStatus.note}</Text>
        </Card>
      )}

      {/* Tab selector */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'preview' && styles.tabActive]}
          onPress={() => setActiveTab('preview')}
        >
          <Ionicons name="eye-outline" size={16} color={activeTab === 'preview' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'preview' && styles.tabTextActive]}>Preview & Send</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons name="time-outline" size={16} color={activeTab === 'history' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Send History</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'preview' ? renderPreviewTab() : renderHistoryTab()}
    </ScrollView>
  );

  /* ──────────────── Preview Tab ──────────────── */

  function renderPreviewTab() {
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
                  {d} days
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
            <Text style={styles.sectionTitle}>Summary</Text>
            <View style={styles.statsGrid}>
              <StatBox label="Reports" value={preview.summary.totalReports} icon="document-text" color={Colors.primary} />
              <StatBox label="Players" value={preview.summary.uniquePlayers} icon="people" color={Colors.accent} />
              <StatBox label="Scouts" value={preview.summary.uniqueScouts} icon="person" color={Colors.green} />
              <StatBox label="Avg Rating" value={preview.summary.avgRating.toFixed(1)} icon="star" color={Colors.amber} />
              <StatBox label="Strong" value={preview.summary.strongProspects} icon="trending-up" color={Colors.green} />
              <StatBox label="Watch" value={preview.summary.watchPlayers} icon="eye" color={Colors.orange} />
            </View>
          </Card>
        )}

        {/* Recipients */}
        {preview && preview.recipients.length > 0 && (
          <Card style={styles.recipientsCard}>
            <Text style={styles.sectionTitle}>
              Recipients ({preview.recipients.length})
            </Text>
            {preview.recipients.map((r, i) => (
              <View key={i} style={styles.recipientRow}>
                <Ionicons name="person-circle-outline" size={20} color={Colors.textSecondary} />
                <View style={styles.recipientInfo}>
                  <Text style={styles.recipientName}>{r.name}</Text>
                  <Text style={styles.recipientEmail}>{r.email}</Text>
                </View>
                <View style={[styles.roleBadge, r.role === 'ADMIN' && styles.roleBadgeAdmin]}>
                  <Text style={styles.roleBadgeText}>{r.role}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Reports preview */}
        {preview && preview.reports.length > 0 && (
          <Card style={styles.reportsPreviewCard}>
            <Text style={styles.sectionTitle}>Reports Included ({preview.reports.length})</Text>
            {preview.reports.slice(0, 10).map((r, i) => (
              <View key={i} style={styles.reportRow}>
                <View style={styles.reportInfo}>
                  <Text style={styles.reportPlayer}>{r.playerName}</Text>
                  <Text style={styles.reportScout}>by {r.scoutName}</Text>
                </View>
                <View style={styles.reportMeta}>
                  <View style={[styles.ratingBadge, { backgroundColor: ratingColor(r.overallRating) + '22' }]}>
                    <Text style={[styles.ratingText, { color: ratingColor(r.overallRating) }]}>
                      {r.overallRating.toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {preview.reports.length > 10 && (
              <Text style={styles.moreText}>+{preview.reports.length - 10} more reports...</Text>
            )}
          </Card>
        )}

        {/* Send Button */}
        <View style={styles.sendSection}>
          <GradientButton
            label={sending ? 'Sending...' : `Send to ${preview?.recipients.length || 0} Recipients`}
            onPress={handleSend}
            disabled={sending || !preview || preview.reportCount === 0}
            icon="send"
          />
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
          <Text style={styles.emptySub}>Email campaigns will appear here after you send weekly reports.</Text>
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
            <Text style={styles.campaignId}>Campaign: {c.campaignId}</Text>
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

/* ────────────── Rating helper ────────────── */

const ratingColor = (v: number) =>
  v <= 2 ? Colors.error : v <= 3.5 ? Colors.amber : Colors.green;

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

  /* SMTP banner */
  smtpCard: { marginBottom: 12, padding: 12 },
  smtpOk: { borderLeftWidth: 3, borderLeftColor: Colors.green },
  smtpWarn: { borderLeftWidth: 3, borderLeftColor: Colors.amber },
  smtpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  smtpText: { fontWeight: '600', fontSize: 14 },
  smtpNote: { color: Colors.textSecondary, fontSize: 12 },

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
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, backgroundColor: Colors.elevated, alignItems: 'center' },
  periodBtnActive: { backgroundColor: Colors.primary + '33', borderWidth: 1, borderColor: Colors.primary },
  periodBtnText: { color: Colors.textSecondary, fontWeight: '500', fontSize: 13 },
  periodBtnTextActive: { color: Colors.primary },
  periodRange: { color: Colors.textSecondary, fontSize: 12, marginTop: 8, textAlign: 'center' },

  /* Stats */
  statsCard: { marginBottom: 12, padding: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },

  /* Recipients */
  recipientsCard: { marginBottom: 12, padding: 14 },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  recipientInfo: { flex: 1 },
  recipientName: { color: Colors.text, fontWeight: '500', fontSize: 14 },
  recipientEmail: { color: Colors.textSecondary, fontSize: 12 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: Colors.elevated },
  roleBadgeAdmin: { backgroundColor: Colors.primary + '22' },
  roleBadgeText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },

  /* Reports preview */
  reportsPreviewCard: { marginBottom: 12, padding: 14 },
  reportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  reportInfo: { flex: 1 },
  reportPlayer: { color: Colors.text, fontWeight: '500', fontSize: 14 },
  reportScout: { color: Colors.textSecondary, fontSize: 12 },
  reportMeta: { alignItems: 'flex-end' },
  ratingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  ratingText: { fontWeight: '700', fontSize: 13 },
  moreText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 },

  /* Send */
  sendSection: { marginTop: 8, marginBottom: 20 },
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
  campaignPeriod: { color: Colors.textSecondary, fontSize: 12, marginBottom: 2 },
  campaignId: { color: Colors.textMuted, fontSize: 11, marginBottom: 8 },
  campaignEntries: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  entryName: { flex: 1, color: Colors.text, fontSize: 13 },
  entryStatus: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
});
