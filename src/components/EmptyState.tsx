import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import GradientButton from './GradientButton';

interface Props {
  icon: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon as any} size={48} color={Colors.textMuted} />
      <Text style={styles.text}>{message}</Text>
      {actionLabel && onAction && (
        <GradientButton title={actionLabel} onPress={onAction} style={{ marginTop: 16, paddingHorizontal: 24 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  text: { color: Colors.textSecondary, fontSize: 16, marginTop: 12, textAlign: 'center' },
});
