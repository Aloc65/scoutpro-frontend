import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/theme/colors';
import LegalFooter from '../src/components/LegalFooter';

function RootGuard() {
  const { user, loading } = useAuth();
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
      router.replace('/dashboard');
    }
  }, [user, loading, segments, router]);

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
      <LegalFooter />
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
