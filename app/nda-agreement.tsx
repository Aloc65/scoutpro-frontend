import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/theme/colors';
import { showConfirm } from '../src/utils/alert';

const NDA_VERSION = '1.0';

const NDA_TEXT = `FFS Scouting – ScoutPro Confidentiality & Non-Disclosure Agreement (NDA)
Version ${NDA_VERSION}

1. Proprietary Software Notice
ScoutPro® and all associated software, interface designs, workflows, source code, reports, data structures, and documentation are proprietary to FFS Scouting and protected by copyright, trademark, and trade secret laws.

2. Confidential Information
By accessing ScoutPro®, you may view confidential information, including player reports, scouting notes, performance analysis, internal assessments, benchmarking data, strategic insights, and communication records. All such information is strictly confidential.

3. Trade Secret Protection
FFS Scouting’s scouting methodology, evaluation framework, analytics models, benchmarking systems, and AI-assisted report processes are valuable trade secrets and must be protected from unauthorised disclosure or use.

4. Non-Disclosure Obligations
You agree to:
• keep all ScoutPro® information confidential;
• use information solely for authorised FFS Scouting business purposes;
• not disclose, forward, copy, publish, or discuss ScoutPro® content with any unauthorised person.

5. Restrictions on Use
You must not, directly or indirectly:
• copy, reproduce, scrape, export, or redistribute ScoutPro® content except as expressly authorised;
• reverse engineer, decompile, disassemble, or attempt to derive software logic or source code;
• use ScoutPro® outputs to support competitors, third-party products, or external organisations.

6. Intellectual Property Ownership
All rights, title, and interest in ScoutPro®, including all derivative outputs, remain exclusively owned by FFS Scouting. Access is a limited, revocable licence and does not transfer ownership rights.

7. Security and Account Responsibility
You are responsible for maintaining the security of your account credentials and for activity under your account. Suspected unauthorised access must be reported immediately.

8. Breach and Remedies
Any breach of this agreement may result in immediate suspension or termination of access, disciplinary action, and legal remedies available to FFS Scouting.

9. Acknowledgment
By selecting “I have read and agree to these terms” and pressing Accept, you acknowledge that you have read, understood, and agree to be legally bound by this NDA.`;

export default function NdaAgreementScreen() {
  const { acceptNda, logout } = useAuth();
  const [checked, setChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    setError('');
    if (!checked) {
      setError('Please confirm that you have read and agree to the terms before continuing.');
      return;
    }

    setAccepting(true);
    try {
      await acceptNda();
    } catch (err: any) {
      setError(err?.message || 'Unable to record NDA acceptance. Please try again.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    showConfirm(
      'Decline NDA',
      'You must accept this NDA to access ScoutPro®. If you decline, you will be logged out.',
      () => logout(),
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>NDA Agreement Required</Text>
          <Text style={styles.subtitle}>You must accept this agreement before using ScoutPro®.</Text>
        </View>

        <View style={styles.card}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.ndaText}>{NDA_TEXT}</Text>
          </ScrollView>

          <TouchableOpacity
            onPress={() => {
              setChecked((prev) => !prev);
              if (error) setError('');
            }}
            style={styles.checkboxRow}
            activeOpacity={0.85}
          >
            <Ionicons
              name={checked ? 'checkbox' : 'square-outline'}
              size={22}
              color={checked ? Colors.accent : Colors.textMuted}
            />
            <Text style={styles.checkboxLabel}>I have read and agree to these terms</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptBtn, (!checked || accepting) && styles.acceptBtnDisabled]}
              onPress={handleAccept}
              disabled={!checked || accepting}
            >
              <Text style={styles.acceptText}>{accepting ? 'Accepting...' : 'Accept & Continue'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 16 },
  iconWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
  },
  scroll: {
    maxHeight: 360,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.elevated,
  },
  scrollContent: { padding: 14 },
  ndaText: { color: Colors.textSecondary, lineHeight: 20, fontSize: 13 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14 },
  checkboxLabel: { flex: 1, color: Colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  errorText: { marginTop: 10, color: Colors.error, fontSize: 13, fontWeight: '500' },
  actions: { marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  declineBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Colors.elevated },
  declineText: { color: Colors.textSecondary, fontWeight: '600' },
  acceptBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Colors.primary },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptText: { color: '#fff', fontWeight: '700' },
});
