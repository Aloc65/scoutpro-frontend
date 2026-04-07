import { Stack } from 'expo-router';
import { Colors } from '../../src/theme/colors';

export default function PlayerLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: Colors.card }, headerTintColor: Colors.text }} />;
}
