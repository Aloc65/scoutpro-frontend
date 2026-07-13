import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { LiveGameProvider } from '../src/context/LiveGameContext';
import { InactivityManager } from '../src/context/InactivityManager';
import { Colors } from '../src/theme/colors';
import LegalFooter from '../src/components/LegalFooter';

function RootGuard() {
  const { user, loading, consumeIntendedRoute } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === 'auth';
    const onChangePassword = inAuth && segments[1] === 'change-password';
    const onNdaAgreement = segments[0] === 'nda-agreement';

    if (!user && !inAuth) {
      router.replace('/auth/login');
      return;
    }

    if (!user) {
      return;
    }

    const requiresPasswordChange = !!user.mustChangePassword;
    const requiresNdaAcceptance = !user.acceptedNdaAt;

    if (requiresPasswordChange && !onChangePassword) {
      router.replace('/auth/change-password');
      return;
    }

    if (!requiresPasswordChange && requiresNdaAcceptance && !onNdaAgreement) {
      router.replace('/nda-agreement');
      return;
    }

    if (!requiresPasswordChange && !requiresNdaAcceptance && (inAuth || onNdaAgreement)) {
      // If the user was redirected to login because their session
      // expired mid-flow, return them to the route they were on.
      consumeIntendedRoute().then((intended) => {
        if (intended) {
          router.replace(intended as any);
        } else {
          router.replace('/dashboard');
        }
      });
    }
  }, [user, loading, segments, router, consumeIntendedRoute]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <InactivityManager>
      <Slot />
    </InactivityManager>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LiveGameProvider>
        <StatusBar style="light" />
        <RootGuard />
        <LegalFooter />
      </LiveGameProvider>
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
