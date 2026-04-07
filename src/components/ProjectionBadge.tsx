import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProjectionColors, Colors } from '../theme/colors';

export default function ProjectionBadge({ value }: { value: string | null }) {
  if (!value) return null;
  const bg = ProjectionColors[value] || Colors.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: bg + '22', borderColor: bg }]}>
      <Text style={[styles.text, { color: bg }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '600' },
});
