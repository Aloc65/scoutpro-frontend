import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

export default function LegalFooter() {
  return (
    <View pointerEvents="none" style={styles.container}>
      <Text style={styles.text}>
        © 2026 FFS Scouting. All rights reserved. ScoutPro® is proprietary software.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 8,
    alignItems: 'center',
    zIndex: 50,
  },
  text: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
    backgroundColor: 'rgba(13, 13, 18, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
