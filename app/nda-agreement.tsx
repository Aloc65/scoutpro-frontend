import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { Colors } from '../src/theme/colors';


const NDA_VERSION = '1.0';

const NDA_TEXT = `NON-DISCLOSURE AND CONFIDENTIALITY AGREEMENT
Version ${NDA_VERSION}

By using ScoutPro, you agree to the following terms:

1. PROPRIETARY SOFTWARE
ScoutPro is proprietary software owned by FFS Scouting. All rights reserved.

2. CONFIDENTIAL INFORMATION
All player data, scouting reports, statistics, analysis, and information accessed through ScoutPro is strictly confidential and proprietary to FFS Scouting.

3. NON-DISCLOSURE OBLIGATIONS
You agree to:
- Keep all information strictly confidential
- Not disclose any data to competitors or third parties
- Not share analysis methods or trade secrets
- Protect login credentials and access

4. TRADE SECRETS
The analytical methods, AI algorithms, rating systems, and proprietary processes used in ScoutPro are trade secrets of FFS Scouting.

5. NO COPYING OR REVERSE ENGINEERING
You may not copy, reproduce, reverse engineer, or create derivative works based on ScoutPro.

6. INTELLECTUAL PROPERTY
All content, software, data, and materials are owned by FFS Scouting. FFS® is a registered trademark.

7. TERMINATION
This agreement remains in effect for the duration of your access to ScoutPro and continues after termination of access.

8. CONSEQUENCES OF BREACH
Breach of this agreement may result in immediate termination of access and legal action.

By clicking "I Accept", you acknowledge that you have read, understood, and agree to be bound by these terms.`;

export default function NdaAgreementScreen() {
  const { acceptNda } = useAuth();
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


  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>FFS Scouting</Text>
          <Text style={styles.subtitle}>ScoutPro® access requires NDA acceptance before continuing.</Text>
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
            <Text style={styles.checkboxLabel}>I have read and agree to the Non-Disclosure and Confidentiality Agreement</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.acceptBtn, (!checked || accepting) && styles.acceptBtnDisabled]}
              onPress={handleAccept}
              disabled={!checked || accepting}
            >
              <Text style={styles.acceptText}>{accepting ? 'Submitting...' : 'I Accept'}</Text>
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
  acceptBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: Colors.primary },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptText: { color: '#fff', fontWeight: '700' },
});
