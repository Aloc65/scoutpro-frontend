import { Stack } from 'expo-router';
import { Image, Text, TouchableOpacity, View, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { useAuth } from '../../src/context/AuthContext';
import NavigationMenu from '../../src/components/NavigationMenu';

export default function AppLayout() {
  const { user, logout } = useAuth();

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
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: Colors.background },
        headerStyle: { backgroundColor: Colors.card },
        headerTintColor: Colors.text,
        headerTitle: () => (
          <View style={styles.headerBrand}>
            <Image source={require('../../assets/ffs-scouting-logo.jpeg')} style={styles.logo} resizeMode="contain" />
          </View>
        ),
        headerTitleAlign: 'left',
        headerRight: () => (
          <View style={styles.headerRight}>
            <NavigationMenu isAdmin={user?.role === 'ADMIN'} />
            <TouchableOpacity onPress={confirmLogout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={18} color={Colors.error} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="reports" options={{ title: 'Reports' }} />
      <Stack.Screen name="players" options={{ title: 'Players' }} />
      <Stack.Screen name="watch-list" options={{ title: 'Watch List' }} />
      <Stack.Screen name="watch-lists" options={{ title: 'Watch Lists' }} />
      <Stack.Screen name="fixtures" options={{ title: 'Fixtures' }} />
      <Stack.Screen name="export" options={{ title: 'Export' }} />
      <Stack.Screen name="data-import" options={{ title: 'Data Import' }} />
      <Stack.Screen name="users" options={{ title: 'Users' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerBrand: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    minWidth: 120,
  },
  logo: {
    width: 106,
    height: 34,
    borderRadius: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 10,
    maxWidth: 380,
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
});
