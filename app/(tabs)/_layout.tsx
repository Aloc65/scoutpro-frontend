import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { useAuth } from '../../src/context/AuthContext';
import { TouchableOpacity, Text, View, StyleSheet, Alert, Platform } from 'react-native';

export default function TabLayout() {
  const { user, logout } = useAuth();

  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        logout();
      }
      return;
    }
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => logout() },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarStyle: {
            backgroundColor: Colors.card,
            borderTopColor: Colors.border,
            height: 60,
            paddingBottom: 8,
          },
          headerStyle: { backgroundColor: Colors.card },
          headerTintColor: Colors.text,
          headerRight: () => (
            <View style={styles.headerRight}>
              <Text style={styles.role}>{user?.role}</Text>
              <TouchableOpacity onPress={confirmLogout} style={styles.logoutBtn}>
                <Ionicons name="log-out-outline" size={22} color={Colors.error || '#ef4444'} />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="players"
          options={{
            title: 'Players',
            tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="watch-list"
          options={{
            title: 'Watch List',
            tabBarIcon: ({ color, size }) => <Ionicons name="eye" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="fixtures"
          options={{
            title: 'Fixtures',
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="export"
          options={{
            title: 'Export',
            tabBarIcon: ({ color, size }) => <Ionicons name="download" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="data-import"
          options={{
            title: 'Data Import',
            tabBarIcon: ({ color, size }) => <Ionicons name="cloud-upload" size={size} color={color} />,
            href: user?.role === 'ADMIN' ? '/(tabs)/data-import' : null,
          }}
        />
        <Tabs.Screen
          name="users"
          options={{
            title: 'Users',
            tabBarIcon: ({ color, size }) => <Ionicons name="person-add" size={size} color={color} />,
            href: user?.role === 'ADMIN' ? '/(tabs)/users' : null,
          }}
        />
      </Tabs>

      <View pointerEvents="none" style={styles.copyrightContainer}>
        <Text style={styles.copyrightText}>
          © 2026 FFS Scouting. All rights reserved. ScoutPro is proprietary software.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  role: { color: Colors.accent, fontSize: 12, fontWeight: '600', marginRight: 10, textTransform: 'uppercase' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', padding: 6, gap: 4, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.12)' },
  logoutText: { color: Colors.error || '#ef4444', fontSize: 12, fontWeight: '600' },
  copyrightContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  copyrightText: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
    backgroundColor: 'rgba(13, 13, 18, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
