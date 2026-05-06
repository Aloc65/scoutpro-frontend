import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../theme/colors';

interface NavigationMenuProps {
  isAdmin: boolean;
}

type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  adminOnly?: boolean;
};

const PRIMARY_ITEMS: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home-outline', href: '/dashboard' },
  { key: 'reports', label: 'Reports', icon: 'document-text-outline', href: '/reports' },
  { key: 'players', label: 'Players', icon: 'people-outline', href: '/players' },
  { key: 'watch-lists', label: 'Watch Lists', icon: 'eye-outline', href: '/watch-lists' },
  { key: 'users', label: 'Users', icon: 'person-outline', href: '/users', adminOnly: true },
];

const SECONDARY_ITEMS: MenuItem[] = [
  { key: 'fixtures', label: 'Fixtures', icon: 'calendar-outline', href: '/fixtures' },
  { key: 'export', label: 'Export', icon: 'download-outline', href: '/export' },
  { key: 'data-import', label: 'Data Import', icon: 'cloud-upload-outline', href: '/data-import', adminOnly: true },
];

const getIsActive = (pathname: string, item: MenuItem): boolean => {
  if (pathname === item.href) {
    return true;
  }

  if (item.href === '/players' && pathname.startsWith('/player/')) {
    return true;
  }

  if (item.href === '/reports' && pathname.startsWith('/report/')) {
    return true;
  }

  if (item.href === '/watch-lists' && pathname.startsWith('/watch-list')) {
    return true;
  }

  return pathname.startsWith(`${item.href}/`);
};

export default function NavigationMenu({ isAdmin }: NavigationMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-8)).current;

  const primaryItems = useMemo(
    () => PRIMARY_ITEMS.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin],
  );

  const secondaryItems = useMemo(
    () => SECONDARY_ITEMS.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin],
  );

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      return;
    }

    fade.setValue(0);
    slide.setValue(-8);
  }, [open, fade, slide]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const toggle = () => setOpen((value) => !value);
  const close = () => setOpen(false);

  const navigate = (href: string) => {
    close();
    if (pathname !== href) {
      router.push(href as never);
    }
  };

  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open navigation menu"
        onPress={toggle}
        style={[styles.iconButton, open && styles.iconButtonOpen]}
      >
        <Ionicons name={open ? 'close' : 'menu'} size={22} color={Colors.text} />
      </TouchableOpacity>

      <Modal
        animationType="none"
        transparent
        visible={open}
        onRequestClose={close}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <Pressable style={styles.overlay} onPress={close}>
          <Animated.View
            style={[
              styles.menu,
              {
                opacity: fade,
                transform: [{ translateY: slide }],
              },
            ]}
          >
            <Pressable onPress={(event) => event.stopPropagation()}>
              {primaryItems.map((item) => {
                const active = getIsActive(pathname, item);
                return (
                  <TouchableOpacity
                    key={item.key}
                    accessibilityRole="button"
                    onPress={() => navigate(item.href)}
                    style={[styles.menuItem, active && styles.menuItemActive]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={active ? Colors.accent : Colors.textSecondary}
                    />
                    <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}

              {secondaryItems.length > 0 ? <View style={styles.divider} /> : null}

              {secondaryItems.map((item) => {
                const active = getIsActive(pathname, item);
                return (
                  <TouchableOpacity
                    key={item.key}
                    accessibilityRole="button"
                    onPress={() => navigate(item.href)}
                    style={[styles.menuItem, active && styles.menuItemActive]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={active ? Colors.accent : Colors.textSecondary}
                    />
                    <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    height: 38,
    width: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconButtonOpen: {
    borderColor: 'rgba(6, 182, 212, 0.45)',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'flex-end',
    paddingTop: 66,
    paddingRight: 14,
  },
  menu: {
    width: 250,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 18,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 6,
    marginHorizontal: 12,
  },
  menuItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginHorizontal: 6,
    marginVertical: 2,
  },
  menuItemActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.14)',
  },
  menuItemText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  menuItemTextActive: {
    color: Colors.accent,
  },
});
