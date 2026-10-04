import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { priorityBadgeLabel } from '../types';

/**
 * Per-watchlist-entry priority tier badge, e.g. "P1 · High".
 *
 * Visually distinct from the (solid green/red) contact-permission badge and the
 * (orange) AFL-interest indicator: it uses a tinted/outlined chip keyed by tier.
 *   1 High    -> red-ish outline
 *   2 Medium  -> amber outline
 *   3 Monitor -> blue outline
 *   4 Hold    -> muted outline
 *   null      -> faint "Not set"
 */
const TIER_COLOR: Record<number, string> = {
  1: '#EF4444', // High
  2: '#F59E0B', // Medium
  3: '#3B82F6', // Monitor
  4: '#8B93A7', // Hold
};

export default function PriorityBadge({
  priority,
  compact = false,
  editable = false,
  style,
}: {
  priority: number | null | undefined;
  compact?: boolean;
  /** Shows a pencil + 'Set priority' when unset, signalling it is tappable. */
  editable?: boolean;
  style?: any;
}) {
  const isSet = priority != null && TIER_COLOR[priority] != null;
  const color = isSet ? TIER_COLOR[priority as number] : Colors.textMuted;
  const label = editable && !isSet ? 'Set priority' : priorityBadgeLabel(priority);

  return (
    <View
      accessibilityLabel={`Priority: ${label}`}
      style={[
        styles.badge,
        {
          borderColor: color,
          backgroundColor: color + '1F',
          paddingHorizontal: compact ? 6 : 8,
          paddingVertical: compact ? 2 : 3,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color, fontSize: compact ? 10 : 12 }]} numberOfLines={1}>
        {label}
      </Text>
      {editable ? (
        <Ionicons name="pencil" size={compact ? 10 : 12} color={color} style={{ marginLeft: 4 }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 7,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: { fontWeight: '700' },
});
