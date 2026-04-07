import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, ratingColor } from '../theme/colors';

export default function RatingBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  const pct = ((value - 1) / 4) * 100;
  const color = ratingColor(value);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.value, { color }]}>{value.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label: { color: Colors.textSecondary, fontSize: 13, width: 110 },
  barBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.elevated, marginHorizontal: 8 },
  barFill: { height: 8, borderRadius: 4 },
  value: { fontSize: 13, fontWeight: '700', width: 30, textAlign: 'right' },
});
