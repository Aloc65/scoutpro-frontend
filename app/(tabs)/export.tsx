import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TextInput, TouchableOpacity } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api/client';
import { Colors } from '../../src/theme/colors';
import GradientButton from '../../src/components/GradientButton';
import Card from '../../src/components/Card';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../src/utils/alert';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ExportScreen() {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      api.get<{ count: number }>('/api/export/reports/count').then((d) => setCount(d.count)).catch(() => {});
    }
  }, [user]);

  if (user?.role !== 'ADMIN') {
    return (
      <View style={styles.container}>
        <Card style={styles.msgCard}>
          <Ionicons name="lock-closed" size={48} color={Colors.textMuted} />
          <Text style={styles.msgTitle}>Admin Only</Text>
          <Text style={styles.msgSub}>Export functionality is restricted to administrators.</Text>
        </Card>
      </View>
    );
  }

  const doExport = async () => {
    try {
      setLoading(true);
      const csv = await api.get<string>('/api/export/reports');
      showAlert('Export Ready', `CSV with ${count} reports generated. In a production build this would be shared via the share sheet.`);
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (text: string) => {
    setEmail(text);
    if (text && !EMAIL_REGEX.test(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const doEmailExport = async () => {
    if (!email) {
      setEmailError('Please enter an email address');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    try {
      setEmailLoading(true);
      setEmailError('');
      const result = await api.post<{ success: boolean; message: string }>('/api/export/reports/email', { email });
      showAlert('Email Sent', result.message || `CSV report sent to ${email}`);
    } catch (e: any) {
      showAlert('Error', e.message || 'Failed to send email');
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.exportCard}>
        <Ionicons name="download-outline" size={48} color={Colors.accent} style={{ alignSelf: 'center' }} />
        <Text style={styles.title}>Export Reports</Text>
        {count != null && <Text style={styles.count}>{count} reports will be exported</Text>}
        <GradientButton title="Download CSV" onPress={doExport} loading={loading} style={{ marginTop: 20 }} />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.emailLabel}>Email CSV Export</Text>
        <View style={styles.emailInputContainer}>
          <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.emailInput}
            placeholder="Enter email address"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={validateEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {emailError ? <Text style={styles.emailErrorText}>{emailError}</Text> : null}

        <TouchableOpacity
          style={[styles.emailButton, emailLoading && styles.emailButtonDisabled]}
          onPress={doEmailExport}
          disabled={emailLoading}
          activeOpacity={0.7}
        >
          <Ionicons name="send-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.emailButtonText}>{emailLoading ? 'Sending...' : 'Email CSV'}</Text>
        </TouchableOpacity>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', padding: 16 },
  exportCard: { padding: 32 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center', marginTop: 16 },
  count: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
  msgCard: { alignItems: 'center', padding: 32 },
  msgTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginTop: 16 },
  msgSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600', marginHorizontal: 12 },
  emailLabel: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary, marginBottom: 10 },
  emailInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.elevated, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  emailInput: { flex: 1, color: Colors.text, fontSize: 15 },
  emailErrorText: { color: '#ef4444', fontSize: 12, marginTop: 4, marginLeft: 4 },
  emailButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 14, marginTop: 14 },
  emailButtonDisabled: { opacity: 0.6 },
  emailButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
