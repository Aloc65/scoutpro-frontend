import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Optional Ionicons name rendered to the left of the label */
  icon?: keyof typeof Ionicons.glyphMap;
  style?: any;
}

export default function GradientButton({ title, onPress, disabled, loading, icon, style }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.btn,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={18} color="#fff" style={styles.icon} />}
          <Text style={styles.text}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  icon: { marginRight: 2 },
  text: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
