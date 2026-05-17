import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import {
  isOnline,
  addNetworkListener,
  addSyncListener,
  syncQueue,
  getQueueLength,
  SyncStatus,
} from '../services/offlineSync';

export default function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>(isOnline() ? 'online' : 'offline');
  const [pending, setPending] = useState(0);

  useEffect(() => {
    // Check initial queue
    getQueueLength().then(setPending);

    const removeNetwork = addNetworkListener((online) => {
      setStatus(online ? 'online' : 'offline');
    });
    const removeSync = addSyncListener((s, p) => {
      setStatus(s);
      setPending(p);
    });

    return () => {
      removeNetwork();
      removeSync();
    };
  }, []);

  if (status === 'online' && pending === 0) {
    return null; // Don't show when everything is fine
  }

  const handlePress = () => {
    if (status !== 'syncing') {
      syncQueue();
    }
  };

  return (
    <TouchableOpacity style={[styles.badge, styles[status]]} onPress={handlePress}>
      {status === 'syncing' ? (
        <ActivityIndicator size="small" color={Colors.amber} />
      ) : status === 'offline' ? (
        <Ionicons name="cloud-offline-outline" size={14} color={Colors.error} />
      ) : (
        <Ionicons name="cloud-done-outline" size={14} color={Colors.green} />
      )}
      <Text style={[styles.text, { color: status === 'offline' ? Colors.error : status === 'syncing' ? Colors.amber : Colors.green }]}>
        {status === 'offline' ? `Offline${pending > 0 ? ` (${pending})` : ''}` :
         status === 'syncing' ? `Syncing ${pending}...` :
         pending > 0 ? `${pending} pending` : 'Synced'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  online: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  offline: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  syncing: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
