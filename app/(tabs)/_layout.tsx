import { Stack } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import AppHeader from '../../src/components/AppHeader';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: Colors.background },
        header: () => <AppHeader />,
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
      <Stack.Screen name="audit-logs" options={{ title: 'Audit Logs' }} />
      <Stack.Screen name="security-alerts" options={{ title: 'Security Alerts' }} />
      <Stack.Screen name="backups" options={{ title: 'Backups' }} />
    </Stack>
  );
}
