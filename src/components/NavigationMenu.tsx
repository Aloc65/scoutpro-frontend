import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../theme/colors';
import { getFollowUps } from '../api/watchList';

interface NavigationMenuProps {
  isAdmin: boolean;
}

type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
};

type AdminGroup = {
  label: string;
  items: MenuItem[];
};

// Primary tabs - visible to all users
const PRIMARY_TABS: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home-outline', href: '/dashboard' },
  { key: 'live-scouting', label: 'Live Scouting', icon: 'american-football-outline', href: '/live-scouting/sessions' },
  { key: 'reports', label: 'Reports', icon: 'document-text-outline', href: '/reports' },
  { key: 'players', label: 'Players', icon: 'people-outline', href: '/players' },
  { key: 'watch-lists', label: 'Watch Lists', icon: 'eye-outline', href: '/watch-lists' },
];

// Admin dropdown groups - only visible to admins
const ADMIN_GROUPS: AdminGroup[] = [
  {
    label: 'Oversight',
    items: [
      { key: 'users', label: 'Users', icon: 'person-outline', href: '/users' },
    ],
  },
  {
    label: 'Scheduling',
    items: [
      { key: 'fixtures', label: 'Fixtures', icon: 'calendar-outline', href: '/fixtures' },
    ],
  },
  {
    label: 'Data',
    items: [
      { key: 'export', label: 'Export', icon: 'download-outline', href: '/export' },
      { key: 'data-import', label: 'Data Import', icon: 'cloud-upload-outline', href: '/data-import' },
    ],
  },
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

  if (item.href === '/live-scouting/sessions' && pathname.startsWith('/live-scouting')) {
    return true;
  }

  return pathname.startsWith(`${item.href}/`);
};

export default function NavigationMenu({ isAdmin }: NavigationMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [adminOpen, setAdminOpen] = useState(false);
  const [followUpsCount, setFollowUpsCount] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-8)).current;

  const adminItems = useMemo(() => {
    return ADMIN_GROUPS.flatMap((group) => group.items);
  }, []);

  const isAdminRoute = useMemo(() => {
    return adminItems.some((item) => getIsActive(pathname, item));
  }, [pathname, adminItems]);

  // Fetch follow-ups count for badge
  useEffect(() => {
    const loadFollowUpsCount = async () => {
      try {
        const data = await getFollowUps('mine');
        setFollowUpsCount(data.total);
      } catch {
        setFollowUpsCount(0);
      }
    };
    loadFollowUpsCount();
  }, [pathname]); // Refresh when navigating

  useEffect(() => {
    if (adminOpen) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      return;
    }

    fade.setValue(0);
    slide.setValue(-8);
  }, [adminOpen, fade, slide]);

  useEffect(() => {
    setAdminOpen(false);
  }, [pathname]);

  const toggleAdmin = () => setAdminOpen((value) => !value);
  const closeAdmin = () => setAdminOpen(false);

  const navigate = (href: string) => {
    closeAdmin();
    if (pathname !== href) {
      router.push(href as never);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      >
        {PRIMARY_TABS.map((tab) => {
          const active = getIsActive(pathname, tab);
          const showBadge = tab.key === 'watch-lists' && followUpsCount > 0;
          return (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="button"
              onPress={() => navigate(tab.href)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={active ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{followUpsCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {isAdmin && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Admin menu"
              onPress={toggleAdmin}
              style={[styles.tab, isAdminRoute && styles.tabActive]}
            >
              <Ionicons
                name="settings-outline"
                size={16}
                color={isAdminRoute ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.tabText, isAdminRoute && styles.tabTextActive]}>Admin</Text>
              <Ionicons
                name={adminOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={isAdminRoute ? Colors.primary : Colors.textSecondary}
              />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {isAdmin && (
        <Modal
          animationType="none"
          transparent
          visible={adminOpen}
          onRequestClose={closeAdmin}
          statusBarTranslucent={Platform.OS === 'android'}
        >
          <Pressable style={styles.overlay} onPress={closeAdmin}>
            <Animated.View
              style={[
                styles.dropdown,
                {
                  opacity: fade,
                  transform: [{ translateY: slide }],
                },
              ]}
            >
              <Pressable onPress={(event) => event.stopPropagation()}>
                {ADMIN_GROUPS.map((group, groupIndex) => (
                  <View key={group.label}>
                    {groupIndex > 0 && <View style={styles.groupDivider} />}
                    <Text style={styles.groupLabel}>{group.label}</Text>
                    {group.items.map((item) => {
                      const active = getIsActive(pathname, item);
                      return (
                        <TouchableOpacity
                          key={item.key}
                          accessibilityRole="button"
                          onPress={() => navigate(item.href)}
                          style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                        >
                          <Ionicons
                            name={item.icon}
                            size={16}
                            color={active ? Colors.accent : Colors.textSecondary}
                          />
                          <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
    paddingRight: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minHeight: 36,
  },
  tabActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'flex-end',
    paddingTop: 66,
    paddingRight: 14,
  },
  dropdown: {
    width: 220,
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
  groupLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  groupDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 6,
    marginHorizontal: 12,
  },
  dropdownItem: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginHorizontal: 6,
    marginVertical: 1,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.14)',
  },
  dropdownItemText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownItemTextActive: {
    color: Colors.accent,
  },
  badge: {
    backgroundColor: Colors.amber,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  badgeText: {
    color: Colors.background,
    fontSize: 10,
    fontWeight: '800',
  },
});
