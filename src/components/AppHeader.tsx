import { Ionicons } from '@expo/vector-icons';
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import NavigationMenu from './NavigationMenu';

/**
 * Full-width application header.
 *
 * Rendered via the Stack navigator's `header` option (NOT `headerTitle`) so that
 * the navigation tabs get a full-width, properly-bounded parent. This is what
 * allows the horizontal tab ScrollView to actually scroll on narrow phone
 * screens instead of being clipped inside the cramped native title slot.
 */
export default function AppHeader() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        logout();
      }
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      {/* Top row: brand + logout */}
      <View style={styles.topRow}>
        <View style={styles.brand}>
          <Image
            source={require('../../assets/ffs-scouting-logo.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <TouchableOpacity onPress={confirmLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom row: full-width scrollable navigation tabs */}
      <View style={styles.navRow}>
        <NavigationMenu isAdmin={user?.role === 'ADMIN'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  brand: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  logo: {
    width: 118,
    height: 38,
    borderRadius: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  logoutText: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 4,
  },
});
