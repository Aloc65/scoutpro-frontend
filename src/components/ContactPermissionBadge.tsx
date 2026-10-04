import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ContactPermission,
  CONTACT_PERMISSION_LABELS,
  CONTACT_PERMISSION_SHORT_LABELS,
} from '../types';

/**
 * Agent-contact-permission badge (AFL approach control).
 *
 * The single most prominent indicator on every player display. Uses BOTH text
 * and colour, and a solid high-contrast fill so it reads clearly on mobile /
 * compact layouts and stands apart from the (outlined) "Signed" stage pill,
 * the priority badge and the AFL-interest indicator.
 *
 *   ALLOWED      -> green  "Agent contact allowed"            (lock-open)
 *   NOT_ALLOWED  -> red    "Do not approach"                  (hand-left / stop)
 *   NOT_RECORDED -> red    "Permission unconfirmed: do not approach" (help/alert)
 *
 * `size="sm"` (default) is used on cards/table rows and uses the short labels;
 * `size="lg"` is used near the player name on the profile and uses the full
 * copy. Colour alone is never relied upon — the text always states the status.
 */
export type ContactPermissionBadgeSize = 'sm' | 'lg';

// Distinct, saturated status colours (not the same tokens as the Signed pill).
const PERMISSION_STYLE: Record<
  ContactPermission,
  { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  ALLOWED: { bg: '#15803D', fg: '#FFFFFF', icon: 'lock-open' },
  NOT_ALLOWED: { bg: '#B91C1C', fg: '#FFFFFF', icon: 'hand-left' },
  NOT_RECORDED: { bg: '#B91C1C', fg: '#FFFFFF', icon: 'alert-circle' },
};

export default function ContactPermissionBadge({
  permission,
  size = 'sm',
  full = false,
  style,
}: {
  permission: ContactPermission | null | undefined;
  size?: ContactPermissionBadgeSize;
  // Force the full label even at small size (e.g. recruitment/contact screens).
  full?: boolean;
  style?: any;
}) {
  const value: ContactPermission = permission ?? 'NOT_RECORDED';
  const cfg = PERMISSION_STYLE[value];
  const isLg = size === 'lg';
  const label =
    isLg || full ? CONTACT_PERMISSION_LABELS[value] : CONTACT_PERMISSION_SHORT_LABELS[value];

  return (
    <View
      accessibilityLabel={`Agent contact permission: ${CONTACT_PERMISSION_LABELS[value]}`}
      style={[
        styles.badge,
        {
          backgroundColor: cfg.bg,
          paddingHorizontal: isLg ? 12 : 8,
          paddingVertical: isLg ? 6 : 3,
          borderRadius: isLg ? 10 : 7,
        },
        style,
      ]}
    >
      <Ionicons name={cfg.icon} size={isLg ? 16 : 12} color={cfg.fg} style={styles.icon} />
      <Text
        style={[styles.text, { color: cfg.fg, fontSize: isLg ? 14 : 11 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  icon: { marginRight: 5 },
  text: { fontWeight: '800' },
});
