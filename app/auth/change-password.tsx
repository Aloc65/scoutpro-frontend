import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { showConfirm } from '../../src/utils/alert';
import { useAuth } from '../../src/context/AuthContext';
import { Colors } from '../../src/theme/colors';
import Input from '../../src/components/Input';
import GradientButton from '../../src/components/GradientButton';
import { Ionicons } from '@expo/vector-icons';

const NDA_VERSION = '1.0';

const NDA_TEXT = `FFS Scouting – ScoutPro Confidentiality & Non-Disclosure Agreement (NDA)
Version ${NDA_VERSION}

1. Proprietary Software Notice
ScoutPro, including its software, interface, workflows, source code, and all related materials, is proprietary to FFS Scouting and protected by copyright and intellectual property law.

2. Confidential Information
By using ScoutPro, you may access confidential information including player reports, scouting notes, performance data, match analysis, internal communications, and related datasets. This information is strictly confidential.

3. Trade Secrets and Proprietary Methods
FFS Scouting owns and protects its proprietary scouting methodologies, evaluation frameworks, comparative models, AI-assisted analysis, benchmarking logic, and report generation processes. These constitute valuable trade secrets.

4. Non-Disclosure Obligations
You agree to:
• keep all ScoutPro data and materials confidential;
• use the information solely for authorised FFS Scouting purposes;
• not disclose, distribute, publish, or share any ScoutPro content with any unauthorised person.

5. Restrictions on Use
You must not, directly or indirectly:
• copy, reproduce, scrape, or extract ScoutPro data beyond authorised business use;
• reverse engineer, decompile, disassemble, or attempt to derive source code or logic from ScoutPro;
• provide ScoutPro outputs, methods, or internal insights to competitors or third parties.

6. Competitor Sharing Prohibition
You are strictly prohibited from sharing ScoutPro content, scouting outputs, analytics, or methods with competing clubs, agencies, recruiters, analysts, software providers, or any competing scouting organisation.

7. Intellectual Property Ownership
All intellectual property rights in ScoutPro and its outputs remain exclusively owned by FFS Scouting. Your access grants a limited, revocable right of use only and does not transfer ownership.

8. Security and Access Control
You are responsible for safeguarding your login credentials and for all actions taken using your account. Any suspected unauthorised access must be reported immediately.

9. Breach and Remedies
Any breach of this agreement may result in immediate suspension or termination of access, disciplinary action, and legal remedies available to FFS Scouting.

10. Acknowledgment
By selecting “I have read and agree to the terms above” and pressing Accept, you acknowledge that you have read, understood, and agree to be legally bound by this NDA.`;

export default function ChangePasswordScreen() {
  const { user, changePassword, acceptNda, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [ndaChecked, setNdaChecked] = useState(false);
  const [acceptingNda, setAcceptingNda] = useState(false);
  const [ndaError, setNdaError] = useState('');

  const mode: 'password' | 'nda' = useMemo(() => {
    if (user?.mustChangePassword) return 'password';
    return 'nda';
  }, [user?.mustChangePassword]);

  const handleChangePassword = async () => {
    setError('');

    if (!currentPassword.trim()) {
      setError('Please enter your current password');
      return;
    }
    if (!newPassword.trim()) {
      setError('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptNda = async () => {
    setNdaError('');
    if (!ndaChecked) {
      setNdaError('Please confirm that you have read and agree to the NDA terms.');
      return;
    }

    setAcceptingNda(true);
    try {
      await acceptNda();
    } catch (err: any) {
      setNdaError(err.message || 'Failed to record NDA acceptance');
    } finally {
      setAcceptingNda(false);
    }
  };

  const handleDeclineNda = () => {
    showConfirm(
      'Decline NDA',
      'You must accept the NDA to access ScoutPro. If you decline, you will be logged out.',
      () => logout(),
    );
  };

  const handleLogout = () => {
    showConfirm(
      'Logout',
      'Are you sure you want to logout? You will need to log in again.',
      () => logout(),
    );
  };

  if (mode === 'nda') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.scrollContent}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark" size={44} color={Colors.primary} />
            </View>
            <Text style={styles.title}>NDA Agreement</Text>
            <Text style={styles.subtitle}>
              Please review and accept the confidentiality agreement to continue to ScoutPro.
            </Text>
          </View>

          <View style={styles.ndaCard}>
            <ScrollView style={styles.ndaTextScroll} contentContainerStyle={styles.ndaTextContent}>
              <Text style={styles.ndaText}>{NDA_TEXT}</Text>
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                setNdaChecked((prev) => !prev);
                if (ndaError) setNdaError('');
              }}
              style={styles.checkboxRow}
              activeOpacity={0.8}
            >
              <Ionicons
                name={ndaChecked ? 'checkbox' : 'square-outline'}
                size={22}
                color={ndaChecked ? Colors.accent : Colors.textMuted}
              />
              <Text style={styles.checkboxLabel}>I have read and agree to the terms above</Text>
            </TouchableOpacity>

            {ndaError ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={Colors.error} />
                <Text style={styles.errorText}>{ndaError}</Text>
              </View>
            ) : null}

            <View style={styles.ndaButtonsRow}>
              <TouchableOpacity style={styles.declineButton} onPress={handleDeclineNda}>
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  (!ndaChecked || acceptingNda) && styles.acceptButtonDisabled,
                ]}
                onPress={handleAcceptNda}
                disabled={!ndaChecked || acceptingNda}
              >
                <Text style={styles.acceptButtonText}>{acceptingNda ? 'Accepting...' : 'Accept'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Change Password</Text>
          <Text style={styles.subtitle}>
            Please change your temporary password to continue using the app.
          </Text>
        </View>

        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={20} color={Colors.amber} />
          <Text style={styles.warningText}>
            Please change your temporary password
          </Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Input
            label="Current Password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="Enter your temporary password"
          />

          <Input
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Minimum 6 characters"
          />

          <Input
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Re-enter new password"
          />

          <GradientButton
            title={loading ? 'Changing Password...' : 'Change Password'}
            onPress={handleChangePassword}
            disabled={loading}
            loading={loading}
          />

          <Text style={styles.logoutLink} onPress={handleLogout}>
            Logout instead
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 183, 77, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.3)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  warningText: {
    color: Colors.amber,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 83, 80, 0.12)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    flex: 1,
  },
  form: {
    gap: 4,
  },
  logoutLink: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  ndaCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  ndaTextScroll: {
    maxHeight: 320,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.elevated,
  },
  ndaTextContent: {
    padding: 14,
  },
  ndaText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  checkboxRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkboxLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  ndaButtonsRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  declineButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.elevated,
  },
  declineButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  acceptButtonDisabled: {
    opacity: 0.5,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
