import { Stack } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import AppHeader from '../../src/components/AppHeader';

export default function LiveScoutingLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: Colors.background },
        header: () => <AppHeader />,
      }}
    >
      <Stack.Screen name="sessions" options={{ title: 'Live Scouting' }} />
      <Stack.Screen name="new-session" options={{ title: 'New Session' }} />
      <Stack.Screen name="add-players" options={{ title: 'Add Players' }} />
      <Stack.Screen name="tracking" options={{ title: 'Live Tracking', headerShown: false }} />
      <Stack.Screen name="grid-tracking" options={{ title: 'Grid Tracking', headerShown: false }} />
      <Stack.Screen name="quarter-review" options={{ title: 'Quarter Review' }} />
      <Stack.Screen name="notes" options={{ title: 'Notes' }} />
      <Stack.Screen name="session-summary" options={{ title: 'Session Summary' }} />
      <Stack.Screen name="ai-analysis" options={{ title: 'AI Analysis' }} />
      <Stack.Screen name="profile-updates" options={{ title: 'Profile Updates' }} />
    </Stack>
  );
}
