import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Modal, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/theme/colors';
import Input from '../../src/components/Input';
import GradientButton from '../../src/components/GradientButton';
import { Ionicons } from '@expo/vector-icons';

const ADMIN_EMAIL = 'lockyer4@bigpond.net.au';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) { setError('Please fill in all fields'); return; }
    try {
      setLoading(true);
      await login(email, password);
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const openMailto = () => {
    Linking.openURL(`mailto:${ADMIN_EMAIL}?subject=Password%20Reset%20Request&body=Hi%2C%0A%0AI%20would%20like%20to%20request%20a%20password%20reset%20for%20my%20ScoutPro%20account.%0A%0AMy%20email%3A%20%0A%0AThank%20you.`);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo area — sits outside the card for breathing room */}
        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/ffs-scouting-logo.jpeg')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Compact login card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <GradientButton title="Sign In" onPress={handleLogin} loading={loading} style={{ marginTop: 4 }} />

          <TouchableOpacity onPress={() => setForgotModalVisible(true)} style={styles.forgotLink}>
            <Text style={styles.forgotLinkText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/auth/signup')} style={styles.link}>
            <Text style={styles.linkText}>
              Don't have an account? <Text style={{ color: Colors.accent }}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal visible={forgotModalVisible} transparent animationType="fade" onRequestClose={() => setForgotModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="lock-closed" size={40} color={Colors.accent} />
            </View>

            <Text style={styles.modalTitle}>Forgot your password?</Text>

            <Text style={styles.modalDescription}>
              Please email the administrator to request a password reset:
            </Text>

            <TouchableOpacity onPress={openMailto} style={styles.emailButton}>
              <Ionicons name="mail-outline" size={18} color="#fff" />
              <Text style={styles.emailButtonText}>{ADMIN_EMAIL}</Text>
            </TouchableOpacity>

            <Text style={styles.modalHint}>
              The administrator will reset your password and provide you with a temporary one.
            </Text>

            <TouchableOpacity onPress={() => setForgotModalVisible(false)} style={styles.backButton}>
              <Ionicons name="arrow-back" size={18} color={Colors.accent} />
              <Text style={styles.backButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 48,
  },
  /* ---- Logo ---- */
  logoWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoImage: {
    width: 320,
    height: 130,
    borderRadius: 14,
  },
  /* ---- Card ---- */
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 380,
    alignSelf: 'center',
    width: '100%',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 14,
  },
  error: { color: Colors.error, fontSize: 13, textAlign: 'center', marginBottom: 6 },
  forgotLink: { marginTop: 12, alignItems: 'center' },
  forgotLinkText: { color: Colors.accent, fontSize: 13, fontWeight: '500' },
  link: { marginTop: 10, alignItems: 'center' },
  linkText: { color: Colors.textSecondary, fontSize: 13 },
  /* ---- Forgot Password Modal ---- */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backButtonText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
