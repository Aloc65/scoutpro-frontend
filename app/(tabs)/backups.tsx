import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, getToken } from '../../src/api/client';
import EmptyState from '../../src/components/EmptyState';
import { Colors } from '../../src/theme/colors';
import { showAlert, showConfirm } from '../../src/utils/alert';
import { useAuth } from '../../src/context/AuthContext';

// ─── Types (mirror backend response shapes) ────────────────────────────────
interface GcsStatus {
  enabled: boolean;
  bucket: string;
  configuredVia: string;
  error: string | null;
}
interface BackupListItem {
  name: string;
  type: 'database' | 'files' | 'unknown';
  size: number;
  createdAt: string | null;
  location: 'local' | 'gcs' | 'local+gcs';
}
interface BackupStatus {
  gcs: GcsStatus;
  retentionDays: number;
  backupDir: string;
  fileDirs: string[];
  pgDumpAvailable: boolean;
  lastDatabaseBackup: BackupListItem | null;
  lastFilesBackup: BackupListItem | null;
  totalBackups: number;
  scheduledTimeAwst: string;
}
type ArchiveReason = 'INACTIVITY' | 'AGE_20';
interface EligiblePlayer {
  id: string;
  fullName: string;
  team: string | null;
  dateOfBirth: string | null;
  age: number | null;
  lastActivityAt: string | null;
  reasons: ArchiveReason[];
  reasonDetail: string;
}
interface ArchivedPlayer {
  id: string;
  fullName: string;
  team: string | null;
  archived: boolean;
  archivedAt: string | null;
  archivedReason: string | null;
  deletedAt: string | null;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${h}:${mins} ${ampm}`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function BackupsScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'backups' | 'archiving'>('backups');

  // Backups state
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [backups, setBackups] = useState<BackupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);

  // Archiving state
  const [archTab, setArchTab] = useState<'eligible' | 'archived' | 'deleted'>('eligible');
  const [eligible, setEligible] = useState<EligiblePlayer[]>([]);
  const [archived, setArchived] = useState<ArchivedPlayer[]>([]);
  const [deleted, setDeleted] = useState<ArchivedPlayer[]>([]);
  const [archLoading, setArchLoading] = useState(true);
  const [archBusy, setArchBusy] = useState<string | null>(null);

  const loadBackups = useCallback(async () => {
    try {
      const [st, list] = await Promise.all([
        api.get<BackupStatus>('/api/backups/status'),
        api.get<BackupListItem[]>('/api/backups'),
      ]);
      setStatus(st);
      setBackups(list || []);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to load backup status');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadArchive = useCallback(async () => {
    try {
      const [el, ar, de] = await Promise.all([
        api.get<EligiblePlayer[]>('/api/archive/eligible'),
        api.get<ArchivedPlayer[]>('/api/archive/archived'),
        api.get<ArchivedPlayer[]>('/api/archive/deleted'),
      ]);
      setEligible(el || []);
      setArchived(ar || []);
      setDeleted(de || []);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to load archive data');
    } finally {
      setArchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadBackups();
      loadArchive();
    }
  }, [loadBackups, loadArchive, user?.role]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBackups(), loadArchive()]);
    setRefreshing(false);
  }, [loadBackups, loadArchive]);

  // ─── Backup actions ───────────────────────────────────────────────────
  const runBackup = useCallback(
    async (type: 'database' | 'files' | 'full') => {
      setRunning(type);
      try {
        await api.post('/api/backups/run', { type });
        showAlert('Backup complete', `The ${type} backup finished. Refreshing the list…`);
        await loadBackups();
      } catch (e: any) {
        showAlert('Backup failed', e.message || `Failed to run ${type} backup`);
      } finally {
        setRunning(null);
      }
    },
    [loadBackups],
  );

  const runCleanup = useCallback(() => {
    showConfirm(
      'Run retention cleanup',
      `This permanently deletes backups older than ${status?.retentionDays ?? 90} days (local + cloud). Continue?`,
      async () => {
        setRunning('cleanup');
        try {
          const res = await api.post<{ deletedLocal: number; deletedGcs: number }>('/api/backups/cleanup');
          showAlert(
            'Cleanup complete',
            `Deleted ${res.deletedLocal} local and ${res.deletedGcs} cloud backup(s).`,
          );
          await loadBackups();
        } catch (e: any) {
          showAlert('Cleanup failed', e.message || 'Failed to run cleanup');
        } finally {
          setRunning(null);
        }
      },
    );
  }, [loadBackups, status?.retentionDays]);

  const downloadBackup = useCallback(async (name: string) => {
    if (Platform.OS !== 'web') {
      showAlert('Info', 'Backup downloads are currently available on the web app.');
      return;
    }
    setBusyName(name);
    try {
      const token = await getToken();
      const res = await fetch(`${api.baseUrl}/api/backups/download?name=${encodeURIComponent(name)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Download failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showAlert('Download failed', e.message || 'Failed to download backup');
    } finally {
      setBusyName(null);
    }
  }, []);

  const restoreBackup = useCallback(
    (name: string) => {
      showConfirm(
        'Restore database',
        `DESTRUCTIVE: This overwrites the current database with "${name}". All data created since this backup will be lost. Are you absolutely sure?`,
        async () => {
          setBusyName(name);
          try {
            await api.post('/api/backups/restore', { name, confirm: true });
            showAlert('Restore complete', `The database was restored from "${name}".`);
          } catch (e: any) {
            showAlert('Restore failed', e.message || 'Failed to restore database');
          } finally {
            setBusyName(null);
          }
        },
      );
    },
    [],
  );

  // ─── Archive actions ──────────────────────────────────────────────────
  const archivePlayer = useCallback(
    (p: EligiblePlayer) => {
      showConfirm(
        'Archive player',
        `Archive ${p.fullName}? They will be hidden from the main player list but kept for records. Reason: ${p.reasonDetail}`,
        async () => {
          setArchBusy(p.id);
          try {
            await api.post(`/api/archive/${p.id}/archive`, { reason: p.reasons[0] || 'MANUAL' });
            await loadArchive();
          } catch (e: any) {
            showAlert('Error', e.message || 'Failed to archive player');
          } finally {
            setArchBusy(null);
          }
        },
      );
    },
    [loadArchive],
  );

  const unarchivePlayer = useCallback(
    async (p: ArchivedPlayer) => {
      setArchBusy(p.id);
      try {
        await api.post(`/api/archive/${p.id}/unarchive`);
        await loadArchive();
      } catch (e: any) {
        showAlert('Error', e.message || 'Failed to unarchive player');
      } finally {
        setArchBusy(null);
      }
    },
    [loadArchive],
  );

  const softDeletePlayer = useCallback(
    (p: ArchivedPlayer) => {
      showConfirm(
        'Delete player',
        `Soft-delete ${p.fullName}? They will be removed from listings but can be recovered later.`,
        async () => {
          setArchBusy(p.id);
          try {
            await api.post(`/api/archive/${p.id}/soft-delete`);
            await loadArchive();
          } catch (e: any) {
            showAlert('Error', e.message || 'Failed to delete player');
          } finally {
            setArchBusy(null);
          }
        },
      );
    },
    [loadArchive],
  );

  const restorePlayer = useCallback(
    async (p: ArchivedPlayer) => {
      setArchBusy(p.id);
      try {
        await api.post(`/api/archive/${p.id}/restore`);
        await loadArchive();
      } catch (e: any) {
        showAlert('Error', e.message || 'Failed to restore player');
      } finally {
        setArchBusy(null);
      }
    },
    [loadArchive],
  );

  // Admin-only access check
  if (user?.role !== 'ADMIN') {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={48} color={Colors.textMuted} />
        <Text style={styles.accessDenied}>Admin Only</Text>
        <Text style={styles.accessDeniedSub}>You do not have permission to access this page.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top-level tab switch */}
      <View style={styles.topTabs}>
        <TouchableOpacity
          style={[styles.topTab, tab === 'backups' && styles.topTabActive]}
          onPress={() => setTab('backups')}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={16}
            color={tab === 'backups' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.topTabText, tab === 'backups' && styles.topTabTextActive]}>Backups</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.topTab, tab === 'archiving' && styles.topTabActive]}
          onPress={() => setTab('archiving')}
        >
          <Ionicons
            name="archive-outline"
            size={16}
            color={tab === 'archiving' ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.topTabText, tab === 'archiving' && styles.topTabTextActive]}>Archiving</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {tab === 'backups' ? (
          <BackupsTab
            loading={loading}
            status={status}
            backups={backups}
            running={running}
            busyName={busyName}
            onRun={runBackup}
            onCleanup={runCleanup}
            onDownload={downloadBackup}
            onRestore={restoreBackup}
          />
        ) : (
          <ArchivingTab
            loading={archLoading}
            archTab={archTab}
            setArchTab={setArchTab}
            eligible={eligible}
            archived={archived}
            deleted={deleted}
            busyId={archBusy}
            onArchive={archivePlayer}
            onUnarchive={unarchivePlayer}
            onSoftDelete={softDeletePlayer}
            onRestore={restorePlayer}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ─── Backups tab ────────────────────────────────────────────────────────────
function BackupsTab(props: {
  loading: boolean;
  status: BackupStatus | null;
  backups: BackupListItem[];
  running: string | null;
  busyName: string | null;
  onRun: (t: 'database' | 'files' | 'full') => void;
  onCleanup: () => void;
  onDownload: (name: string) => void;
  onRestore: (name: string) => void;
}) {
  const { loading, status, backups, running, busyName, onRun, onCleanup, onDownload, onRestore } = props;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const gcs = status?.gcs;

  return (
    <View>
      {/* Status cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Status</Text>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Ionicons
                name={gcs?.enabled ? 'cloud-done-outline' : 'cloud-offline-outline'}
                size={20}
                color={gcs?.enabled ? Colors.green : Colors.amber}
              />
              <Text style={styles.statusLabel}>Cloud Storage (GCS)</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: gcs?.enabled ? Colors.green : Colors.amber }]}>
              <Text style={styles.pillText}>{gcs?.enabled ? 'Connected' : 'Local only'}</Text>
            </View>
          </View>
          <Text style={styles.statusDetail}>
            Bucket: {gcs?.bucket || '—'}
            {gcs?.configuredVia ? `  ·  via ${gcs.configuredVia}` : ''}
          </Text>
          {gcs?.error ? <Text style={styles.statusError}>{gcs.error}</Text> : null}

          <View style={styles.divider} />

          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Ionicons
                name={status?.pgDumpAvailable ? 'checkmark-circle-outline' : 'warning-outline'}
                size={20}
                color={status?.pgDumpAvailable ? Colors.green : Colors.error}
              />
              <Text style={styles.statusLabel}>Database tools (pg_dump)</Text>
            </View>
            <View
              style={[styles.pill, { backgroundColor: status?.pgDumpAvailable ? Colors.green : Colors.error }]}
            >
              <Text style={styles.pillText}>{status?.pgDumpAvailable ? 'Available' : 'Missing'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoValue}>{status?.totalBackups ?? 0}</Text>
              <Text style={styles.infoLabel}>Total backups</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoValue}>{status?.retentionDays ?? 90}d</Text>
              <Text style={styles.infoLabel}>Retention</Text>
            </View>
          </View>

          <View style={styles.scheduleRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.scheduleText}>Daily automatic backup at {status?.scheduledTimeAwst}</Text>
          </View>
          <View style={styles.scheduleRow}>
            <Ionicons name="calendar-clear-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.scheduleText}>
              Last DB backup: {formatTimestamp(status?.lastDatabaseBackup?.createdAt ?? null)}
            </Text>
          </View>
          <View style={styles.scheduleRow}>
            <Ionicons name="folder-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.scheduleText}>
              Last files backup: {formatTimestamp(status?.lastFilesBackup?.createdAt ?? null)}
            </Text>
          </View>
        </View>
      </View>

      {/* Manual actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Run a Backup Now</Text>
        <View style={styles.actionRow}>
          <ActionButton
            icon="server-outline"
            label="Database"
            loading={running === 'database'}
            disabled={!!running}
            onPress={() => onRun('database')}
          />
          <ActionButton
            icon="documents-outline"
            label="Files"
            loading={running === 'files'}
            disabled={!!running}
            onPress={() => onRun('files')}
          />
          <ActionButton
            icon="albums-outline"
            label="Full"
            primary
            loading={running === 'full'}
            disabled={!!running}
            onPress={() => onRun('full')}
          />
        </View>
        <TouchableOpacity
          style={[styles.cleanupBtn, running === 'cleanup' && styles.disabled]}
          disabled={!!running}
          onPress={onCleanup}
        >
          {running === 'cleanup' ? (
            <ActivityIndicator size="small" color={Colors.error} />
          ) : (
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
          )}
          <Text style={styles.cleanupText}>Run retention cleanup</Text>
        </TouchableOpacity>
      </View>

      {/* Backup list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Backups</Text>
        {backups.length === 0 ? (
          <EmptyState icon="cloud-outline" message="No backups yet. Run one above to get started." />
        ) : (
          <View style={{ gap: 10 }}>
            {backups.map((b) => (
              <View key={b.name} style={styles.backupCard}>
                <View style={styles.backupHeader}>
                  <Ionicons
                    name={b.type === 'database' ? 'server-outline' : b.type === 'files' ? 'documents-outline' : 'cube-outline'}
                    size={18}
                    color={Colors.accent}
                  />
                  <Text style={styles.backupName} numberOfLines={1}>
                    {b.name}
                  </Text>
                </View>
                <View style={styles.backupMeta}>
                  <Text style={styles.backupMetaText}>{formatBytes(b.size)}</Text>
                  <Text style={styles.backupMetaDot}>·</Text>
                  <Text style={styles.backupMetaText}>{formatTimestamp(b.createdAt)}</Text>
                  <Text style={styles.backupMetaDot}>·</Text>
                  <View style={styles.locBadge}>
                    <Ionicons
                      name={b.location.includes('gcs') ? 'cloud-outline' : 'hardware-chip-outline'}
                      size={11}
                      color={Colors.textMuted}
                    />
                    <Text style={styles.locText}>{b.location}</Text>
                  </View>
                </View>
                <View style={styles.backupActions}>
                  <TouchableOpacity
                    style={styles.smallBtn}
                    disabled={busyName === b.name}
                    onPress={() => onDownload(b.name)}
                  >
                    <Ionicons name="download-outline" size={15} color={Colors.text} />
                    <Text style={styles.smallBtnText}>Download</Text>
                  </TouchableOpacity>
                  {b.type === 'database' ? (
                    <TouchableOpacity
                      style={[styles.smallBtn, styles.dangerBtn]}
                      disabled={busyName === b.name}
                      onPress={() => onRestore(b.name)}
                    >
                      {busyName === b.name ? (
                        <ActivityIndicator size="small" color={Colors.error} />
                      ) : (
                        <Ionicons name="refresh-outline" size={15} color={Colors.error} />
                      )}
                      <Text style={[styles.smallBtnText, { color: Colors.error }]}>Restore</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function ActionButton(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { icon, label, primary, loading, disabled, onPress } = props;
  return (
    <TouchableOpacity
      style={[styles.actionBtn, primary && styles.actionBtnPrimary, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? '#fff' : Colors.primary} />
      ) : (
        <Ionicons name={icon} size={20} color={primary ? '#fff' : Colors.primary} />
      )}
      <Text style={[styles.actionBtnText, primary && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Archiving tab ──────────────────────────────────────────────────────────
function ArchivingTab(props: {
  loading: boolean;
  archTab: 'eligible' | 'archived' | 'deleted';
  setArchTab: (t: 'eligible' | 'archived' | 'deleted') => void;
  eligible: EligiblePlayer[];
  archived: ArchivedPlayer[];
  deleted: ArchivedPlayer[];
  busyId: string | null;
  onArchive: (p: EligiblePlayer) => void;
  onUnarchive: (p: ArchivedPlayer) => void;
  onSoftDelete: (p: ArchivedPlayer) => void;
  onRestore: (p: ArchivedPlayer) => void;
}) {
  const {
    loading,
    archTab,
    setArchTab,
    eligible,
    archived,
    deleted,
    busyId,
    onArchive,
    onUnarchive,
    onSoftDelete,
    onRestore,
  } = props;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const subTabs: { key: 'eligible' | 'archived' | 'deleted'; label: string; count: number }[] = [
    { key: 'eligible', label: 'Eligible', count: eligible.length },
    { key: 'archived', label: 'Archived', count: archived.length },
    { key: 'deleted', label: 'Deleted', count: deleted.length },
  ];

  return (
    <View>
      <View style={styles.section}>
        <View style={styles.subTabRow}>
          {subTabs.map((t) => {
            const active = archTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.subTab, active && styles.subTabActive]}
                onPress={() => setArchTab(t.key)}
              >
                <Text style={[styles.subTabText, active && styles.subTabTextActive]}>
                  {t.label} ({t.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {archTab === 'eligible' ? (
          <View>
            <Text style={styles.helperText}>
              Players flagged by retention rules (no activity for 12+ months, or turned 20). Review and archive
              as needed — nothing is archived automatically.
            </Text>
            {eligible.length === 0 ? (
              <EmptyState icon="checkmark-done-outline" message="No players currently eligible for archiving." />
            ) : (
              <View style={{ gap: 10 }}>
                {eligible.map((p) => (
                  <View key={p.id} style={styles.playerCard}>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>{p.fullName}</Text>
                      <Text style={styles.playerSub}>
                        {p.team || 'No team'}
                        {p.age != null ? ` · Age ${p.age}` : ''}
                      </Text>
                      <View style={styles.reasonRow}>
                        {p.reasons.map((r) => (
                          <View
                            key={r}
                            style={[styles.reasonBadge, { backgroundColor: r === 'AGE_20' ? Colors.orange : Colors.amber }]}
                          >
                            <Text style={styles.reasonBadgeText}>
                              {r === 'AGE_20' ? 'Turned 20' : 'Inactive 12mo+'}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.playerDetail}>{p.reasonDetail}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.archiveBtn}
                      disabled={busyId === p.id}
                      onPress={() => onArchive(p)}
                    >
                      {busyId === p.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="archive-outline" size={15} color="#fff" />
                          <Text style={styles.archiveBtnText}>Archive</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {archTab === 'archived' ? (
          <View>
            <Text style={styles.helperText}>
              Archived players are hidden from the main list but retained. You can restore them to active at any
              time, or soft-delete them.
            </Text>
            {archived.length === 0 ? (
              <EmptyState icon="archive-outline" message="No archived players." />
            ) : (
              <View style={{ gap: 10 }}>
                {archived.map((p) => (
                  <View key={p.id} style={styles.playerCard}>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>{p.fullName}</Text>
                      <Text style={styles.playerSub}>{p.team || 'No team'}</Text>
                      <Text style={styles.playerDetail}>
                        Archived {formatTimestamp(p.archivedAt)}
                        {p.archivedReason ? ` · ${p.archivedReason}` : ''}
                      </Text>
                    </View>
                    <View style={styles.stackedActions}>
                      <TouchableOpacity
                        style={styles.smallBtn}
                        disabled={busyId === p.id}
                        onPress={() => onUnarchive(p)}
                      >
                        {busyId === p.id ? (
                          <ActivityIndicator size="small" color={Colors.text} />
                        ) : (
                          <Ionicons name="arrow-undo-outline" size={15} color={Colors.text} />
                        )}
                        <Text style={styles.smallBtnText}>Restore</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallBtn, styles.dangerBtn]}
                        disabled={busyId === p.id}
                        onPress={() => onSoftDelete(p)}
                      >
                        <Ionicons name="trash-outline" size={15} color={Colors.error} />
                        <Text style={[styles.smallBtnText, { color: Colors.error }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {archTab === 'deleted' ? (
          <View>
            <Text style={styles.helperText}>
              Soft-deleted players are removed from all listings but can be recovered. Use this to undo accidental
              deletions.
            </Text>
            {deleted.length === 0 ? (
              <EmptyState icon="trash-outline" message="No soft-deleted players." />
            ) : (
              <View style={{ gap: 10 }}>
                {deleted.map((p) => (
                  <View key={p.id} style={styles.playerCard}>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>{p.fullName}</Text>
                      <Text style={styles.playerSub}>{p.team || 'No team'}</Text>
                      <Text style={styles.playerDetail}>Deleted {formatTimestamp(p.deletedAt)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.archiveBtn}
                      disabled={busyId === p.id}
                      onPress={() => onRestore(p)}
                    >
                      {busyId === p.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="arrow-undo-outline" size={15} color="#fff" />
                          <Text style={styles.archiveBtnText}>Recover</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: 24 },
  centered: { paddingVertical: 64, alignItems: 'center' },
  accessDenied: { color: Colors.text, fontSize: 20, fontWeight: '700', marginTop: 12 },
  accessDeniedSub: { color: Colors.textSecondary, fontSize: 14, marginTop: 6, textAlign: 'center' },

  topTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topTabActive: { borderColor: Colors.primary, backgroundColor: Colors.background },
  topTabText: { color: Colors.textMuted, fontSize: 14, fontWeight: '700' },
  topTabTextActive: { color: Colors.primary },

  section: { padding: 16, paddingTop: 16 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },

  statusCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  statusDetail: { color: Colors.textSecondary, fontSize: 13, marginTop: 6 },
  statusError: { color: Colors.error, fontSize: 12, marginTop: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },

  infoGrid: { flexDirection: 'row', gap: 12 },
  infoItem: {
    flex: 1,
    backgroundColor: Colors.elevated,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  infoValue: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  infoLabel: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },

  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  scheduleText: { color: Colors.textMuted, fontSize: 12 },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  actionBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },

  cleanupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  cleanupText: { color: Colors.error, fontSize: 13, fontWeight: '700' },

  backupCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backupName: { color: Colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  backupMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  backupMetaText: { color: Colors.textMuted, fontSize: 12 },
  backupMetaDot: { color: Colors.textMuted, fontSize: 12 },
  locBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locText: { color: Colors.textMuted, fontSize: 12 },
  backupActions: { flexDirection: 'row', gap: 10, marginTop: 12 },

  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  smallBtnText: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  dangerBtn: { borderColor: Colors.error },

  subTabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  subTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  subTabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  subTabTextActive: { color: '#fff' },

  helperText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 14 },

  playerCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  playerInfo: { flex: 1 },
  playerName: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  playerSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  playerDetail: { color: Colors.textMuted, fontSize: 12, marginTop: 6 },
  reasonRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  reasonBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  reasonBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  archiveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  stackedActions: { gap: 8 },

  disabled: { opacity: 0.5 },
});
