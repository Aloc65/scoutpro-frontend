import { Platform } from 'react-native';

// ─── Storage Adapter ─────────────────────────────────────────────────
// Uses localStorage on web, AsyncStorage on native

let AsyncStorage: any = null;
if (Platform.OS !== 'web') {
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch {
    // AsyncStorage not available, will use in-memory fallback
  }
}

const OFFLINE_QUEUE_KEY = 'scoutpro_offline_queue';
const OFFLINE_SESSIONS_KEY = 'scoutpro_offline_sessions';
const SYNC_STATUS_KEY = 'scoutpro_sync_status';

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  if (AsyncStorage) {
    return AsyncStorage.getItem(key);
  }
  return null;
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  if (AsyncStorage) {
    await AsyncStorage.setItem(key, value);
  }
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  if (AsyncStorage) {
    await AsyncStorage.removeItem(key);
  }
}

// ─── Types ────────────────────────────────────────────────────────────

export interface QueuedAction {
  id: string;
  timestamp: number;
  type: 'updateStats' | 'saveReview' | 'saveNotes' | 'completeSession';
  endpoint: string;
  method: 'POST' | 'PATCH';
  body: any;
  retries: number;
}

export type SyncStatus = 'online' | 'offline' | 'syncing';

// ─── Network Detection ───────────────────────────────────────────────

let _isOnline = true;
let _listeners: Array<(online: boolean) => void> = [];

export function isOnline(): boolean {
  return _isOnline;
}

export function addNetworkListener(listener: (online: boolean) => void): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

function notifyListeners() {
  _listeners.forEach((l) => l(_isOnline));
}

// Web network detection
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  _isOnline = navigator.onLine;
  window.addEventListener('online', () => {
    _isOnline = true;
    notifyListeners();
    syncQueue(); // Auto-sync when back online
  });
  window.addEventListener('offline', () => {
    _isOnline = false;
    notifyListeners();
  });
}

// Periodic online check via ping (for native or flaky web detection)
let _pingInterval: any = null;
export function startNetworkMonitoring(intervalMs = 15000) {
  if (_pingInterval) return;
  _pingInterval = setInterval(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch('/api/health', { method: 'HEAD', signal: controller.signal }).catch(() => {});
      clearTimeout(timeout);
      if (!_isOnline) {
        _isOnline = true;
        notifyListeners();
        syncQueue();
      }
    } catch {
      if (_isOnline) {
        _isOnline = false;
        notifyListeners();
      }
    }
  }, intervalMs);
}

export function stopNetworkMonitoring() {
  if (_pingInterval) {
    clearInterval(_pingInterval);
    _pingInterval = null;
  }
}

// ─── Action Queue ─────────────────────────────────────────────────────

export async function getQueue(): Promise<QueuedAction[]> {
  const raw = await getItem(OFFLINE_QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function addToQueue(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries'>): Promise<void> {
  const queue = await getQueue();
  queue.push({
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    retries: 0,
  });
  await setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function clearQueue(): Promise<void> {
  await removeItem(OFFLINE_QUEUE_KEY);
}

export async function getQueueLength(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

// ─── Session Cache ────────────────────────────────────────────────────

export async function cacheSession(sessionId: string, data: any): Promise<void> {
  const sessions = await getCachedSessions();
  sessions[sessionId] = { data, cachedAt: Date.now() };
  await setItem(OFFLINE_SESSIONS_KEY, JSON.stringify(sessions));
}

export async function getCachedSession(sessionId: string): Promise<any | null> {
  const sessions = await getCachedSessions();
  return sessions[sessionId]?.data || null;
}

async function getCachedSessions(): Promise<Record<string, { data: any; cachedAt: number }>> {
  const raw = await getItem(OFFLINE_SESSIONS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ─── Sync Engine ──────────────────────────────────────────────────────

let _syncing = false;
let _syncListeners: Array<(status: SyncStatus, pending: number) => void> = [];

export function addSyncListener(listener: (status: SyncStatus, pending: number) => void): () => void {
  _syncListeners.push(listener);
  return () => {
    _syncListeners = _syncListeners.filter((l) => l !== listener);
  };
}

function notifySyncListeners(status: SyncStatus, pending: number) {
  _syncListeners.forEach((l) => l(status, pending));
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  if (_syncing || !_isOnline) return { synced: 0, failed: 0 };
  _syncing = true;

  const queue = await getQueue();
  if (queue.length === 0) {
    _syncing = false;
    notifySyncListeners('online', 0);
    return { synced: 0, failed: 0 };
  }

  notifySyncListeners('syncing', queue.length);

  let synced = 0;
  let failed = 0;
  const remaining: QueuedAction[] = [];

  // Import getToken to get auth header
  const { getToken } = require('../api/client');
  const token = await getToken();
  const { api } = require('../api/client');
  const baseUrl = api.baseUrl;

  for (const action of queue) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}${action.endpoint}`, {
        method: action.method,
        headers,
        body: action.body ? JSON.stringify(action.body) : undefined,
      });

      if (res.ok) {
        synced++;
      } else if (res.status >= 400 && res.status < 500) {
        // Client error, don't retry
        failed++;
        console.warn(`Sync: dropped action ${action.id} due to ${res.status}`);
      } else {
        // Server error, retry later
        action.retries++;
        if (action.retries < 5) {
          remaining.push(action);
        } else {
          failed++;
        }
      }
    } catch {
      action.retries++;
      if (action.retries < 5) {
        remaining.push(action);
      } else {
        failed++;
      }
    }
  }

  await setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  _syncing = false;
  notifySyncListeners(remaining.length > 0 ? 'offline' : 'online', remaining.length);

  return { synced, failed };
}

// ─── Offline-aware API wrapper ────────────────────────────────────────

export async function offlineStatUpdate(
  sessionId: string,
  playerId: string,
  quarter: number,
  field: string,
  delta: number,
  localSession: any,
): Promise<{ queuedOffline: boolean; localUpdate: any }> {
  const endpoint = `/api/live-scouting/sessions/${sessionId}/players/${playerId}/quarters/${quarter}/stats`;

  if (!_isOnline) {
    // Queue for later sync
    await addToQueue({
      type: 'updateStats',
      endpoint,
      method: 'POST',
      body: { field, delta },
    });

    // Update local cache
    const updatedSession = applyLocalStatUpdate(localSession, playerId, quarter, field, delta);
    await cacheSession(sessionId, updatedSession);

    return { queuedOffline: true, localUpdate: updatedSession };
  }

  return { queuedOffline: false, localUpdate: null };
}

function applyLocalStatUpdate(session: any, playerId: string, quarter: number, field: string, delta: number): any {
  if (!session) return session;
  const sessionPlayers = session.sessionPlayers.map((sp: any) => {
    if (sp.playerId !== playerId) return sp;
    const quarterData = sp.quarterData.map((qd: any) => {
      if (qd.quarter !== quarter) return qd;
      const currentVal = (qd as any)[field] || 0;
      return { ...qd, [field]: Math.max(0, currentVal + delta) };
    });
    return { ...sp, quarterData };
  });
  return { ...session, sessionPlayers };
}
