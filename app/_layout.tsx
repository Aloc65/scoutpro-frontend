import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/theme/colors';

function RootGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'auth';
    const onChangePassword = segments[0] === 'auth' && segments[1] === 'change-password';

    if (!user && !inAuth) {
      // Not logged in, redirect to login
      router.replace('/auth/login');
      return;
    }

    if (!user) {
      return;
    }

    const requiresPasswordChange = !!user.mustChangePassword;
    const requiresNdaAcceptance = !user.acceptedNdaAt;

    if ((requiresPasswordChange || requiresNdaAcceptance) && !onChangePassword) {
      router.replace('/auth/change-password');
      return;
    }

    if (!requiresPasswordChange && !requiresNdaAcceptance && inAuth) {
      // Logged in and fully onboarded, but on auth screen - go to dashboard
      router.replace('/(tabs)/dashboard');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootGuard />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
