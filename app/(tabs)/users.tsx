import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  TextInput, Alert, ActivityIndicator, RefreshControl, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api/client';
import { showAlert, showConfirm } from '../../src/utils/alert';

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SCOUT';
  createdAt: string;
}

interface UserForm {
  email: string;
  name: string;
  role: 'ADMIN' | 'SCOUT';
  password: string;
}

const EMPTY_FORM: UserForm = { email: '', name: '', role: 'SCOUT', password: '' };

export default function UsersScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reset password modal state
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetUser, setResetUser] = useState<UserItem | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.get<{ users: UserItem[] }>('/api/users');
      setUsers(data.users);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalVisible(true);
  };

  const openEditModal = (u: UserItem) => {
    setEditingUser(u);
    setForm({ email: u.email, name: u.name, role: u.role, password: '' });
    setError('');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const handleSave = async () => {
    setError('');
    if (!form.email.trim() || !form.name.trim()) {
      setError('Email and name are required');
      return;
    }
    if (!editingUser && form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const body: any = { email: form.email, name: form.name, role: form.role };
        if (form.password.length > 0) body.password = form.password;
        await api.put(`/api/users/${editingUser.id}`, body);
        showSuccess(`User "${form.name}" updated successfully`);
      } else {
        await api.post('/api/users', form);
        showSuccess(`User "${form.name}" created successfully`);
      }
      closeModal();
      fetchUsers();
    } catch (e: any) {
      setError(e.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (u: UserItem) => {
    if (u.id === user?.id) {
      showAlert('Error', 'You cannot delete your own account');
      return;
    }
    showConfirm(
      'Delete User',
      `Are you sure you want to delete "${u.name}" (${u.email})? This action cannot be undone.`,
      async () => {
        try {
          await api.delete(`/api/users/${u.id}`);
          showSuccess(`User "${u.name}" deleted successfully`);
          fetchUsers();
        } catch (e: any) {
          showAlert('Error', e.message || 'Failed to delete user');
        }
      },
    );
  };

  // ---- Reset Password handlers ----
  const openResetModal = (u: UserItem) => {
    setResetUser(u);
    setResetPassword('');
    setResetError('');
    setResetModalVisible(true);
  };

  const closeResetModal = () => {
    setResetModalVisible(false);
    setResetUser(null);
    setResetPassword('');
    setResetError('');
  };

  const handleResetPassword = async () => {
    setResetError('');
    if (resetPassword.length < 6) {
      setResetError('Temporary password must be at least 6 characters');
      return;
    }
    if (!resetUser) return;

    setResetting(true);
    try {
      await api.put(`/api/users/${resetUser.id}`, {
        password: resetPassword,
        mustChangePassword: true,
      });
      closeResetModal();
      showSuccess(`Password reset successfully. Share the new temporary password with ${resetUser.name}.`);
    } catch (e: any) {
      setResetError(e.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  // Admin-only access check
  if (user?.role !== 'ADMIN') {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={48} color={Colors.textMuted} />
        <Text style={styles.accessDenied}>Admin Only</Text>
        <Text style={styles.accessDeniedSub}>You do not have permission to access this page.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderUser = ({ item }: { item: UserItem }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={[styles.roleBadge, item.role === 'ADMIN' ? styles.roleBadgeAdmin : styles.roleBadgeScout]}>
            <Text style={[styles.roleBadgeText, item.role === 'ADMIN' ? styles.roleBadgeTextAdmin : styles.roleBadgeTextScout]}>
              {item.role}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity onPress={() => openResetModal(item)} style={styles.actionBtn} accessibilityLabel="Reset password">
          <Ionicons name="key-outline" size={20} color={Colors.amber} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn} accessibilityLabel="Edit user">
          <Ionicons name="create-outline" size={20} color={Colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn} accessibilityLabel="Delete user">
          <Ionicons name="trash-outline" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Success banner */}
      {successMsg ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.green} />
          <Text style={styles.successText}>{successMsg}</Text>
        </View>
      ) : null}

      {/* Header area */}
      <View style={styles.header}>
        <Text style={styles.title}>User Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add User</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>{users.length} user{users.length !== 1 ? 's' : ''} total</Text>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchUsers(); }}
            tintColor={Colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
      />

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingUser ? 'Edit User' : 'Create New User'}
                </Text>
                <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Name */}
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
                placeholder="Full name"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
              />

              {/* Email */}
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(v) => setForm({ ...form, email: v })}
                placeholder="user@example.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {/* Role Selector */}
              <Text style={styles.label}>Role</Text>
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[styles.roleOption, form.role === 'SCOUT' && styles.roleOptionActive]}
                  onPress={() => setForm({ ...form, role: 'SCOUT' })}
                >
                  <Ionicons name="eye-outline" size={18} color={form.role === 'SCOUT' ? '#fff' : Colors.textSecondary} />
                  <Text style={[styles.roleOptionText, form.role === 'SCOUT' && styles.roleOptionTextActive]}>Scout</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleOption, form.role === 'ADMIN' && styles.roleOptionActiveAdmin]}
                  onPress={() => setForm({ ...form, role: 'ADMIN' })}
                >
                  <Ionicons name="shield-outline" size={18} color={form.role === 'ADMIN' ? '#fff' : Colors.textSecondary} />
                  <Text style={[styles.roleOptionText, form.role === 'ADMIN' && styles.roleOptionTextActive]}>Admin</Text>
                </TouchableOpacity>
              </View>

              {/* Password */}
              <Text style={styles.label}>
                Password {editingUser ? '(leave blank to keep current)' : ''}
              </Text>
              <TextInput
                style={styles.input}
                value={form.password}
                onChangeText={(v) => setForm({ ...form, password: v })}
                placeholder={editingUser ? '••••••••' : 'Min 6 characters'}
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
              />

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingUser ? 'Update User' : 'Create User'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal visible={resetModalVisible} transparent animationType="fade" onRequestClose={closeResetModal}>
        <View style={styles.resetOverlay}>
          <View style={styles.resetContent}>
            <View style={styles.resetIconWrap}>
              <Ionicons name="key" size={32} color={Colors.amber} />
            </View>

            <Text style={styles.resetTitle}>Reset Password</Text>

            {resetUser && (
              <Text style={styles.resetSubtitle}>
                Set a new temporary password for{'\n'}
                <Text style={{ fontWeight: '700', color: Colors.text }}>{resetUser.name}</Text>
                {' '}({resetUser.email})
              </Text>
            )}

            {resetError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{resetError}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>New Temporary Password</Text>
            <TextInput
              style={styles.input}
              value={resetPassword}
              onChangeText={setResetPassword}
              placeholder="Min 6 characters"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={false}
              autoCapitalize="none"
            />

            <View style={styles.resetHintBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.accent} />
              <Text style={styles.resetHintText}>
                The user will be required to change this password on their next login.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.resetButton, resetting && styles.saveButtonDisabled]}
              onPress={handleResetPassword}
              disabled={resetting}
            >
              {resetting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.resetButtonText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={closeResetModal} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, paddingHorizontal: 16, marginBottom: 8 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 4,
  },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  userCard: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  userDetails: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  userEmail: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  roleBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
  },
  roleBadgeAdmin: { backgroundColor: 'rgba(79, 70, 229, 0.2)' },
  roleBadgeScout: { backgroundColor: 'rgba(6, 182, 212, 0.2)' },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  roleBadgeTextAdmin: { color: Colors.primary },
  roleBadgeTextScout: { color: Colors.accent },
  userActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: Colors.elevated,
    justifyContent: 'center', alignItems: 'center',
  },
  // Success / Error banners
  successBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  successText: { color: Colors.green, fontSize: 14, fontWeight: '500', flex: 1 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 8, marginBottom: 12,
  },
  errorText: { color: Colors.error, fontSize: 13, flex: 1 },
  emptyText: { color: Colors.textMuted, fontSize: 16, marginTop: 12 },
  // Access Denied
  accessDenied: { color: Colors.text, fontSize: 20, fontWeight: '700', marginTop: 16 },
  accessDeniedSub: { color: Colors.textSecondary, fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  // Create/Edit Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  closeBtn: { padding: 4 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: Colors.elevated, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border,
  },
  roleSelector: { flexDirection: 'row', gap: 10 },
  roleOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.elevated,
    borderWidth: 1, borderColor: Colors.border, gap: 6,
  },
  roleOptionActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  roleOptionActiveAdmin: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleOptionText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 14 },
  roleOptionTextActive: { color: '#fff' },
  saveButton: {
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 24, marginBottom: 20,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Reset Password Modal
  resetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  resetContent: {
    backgroundColor: Colors.card, borderRadius: 16, padding: 24,
    width: '100%', maxWidth: 400, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  resetIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  resetTitle: {
    fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 8,
  },
  resetSubtitle: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: 16,
  },
  resetHintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.08)', borderRadius: 8,
    padding: 12, marginTop: 16, width: '100%',
  },
  resetHintText: {
    fontSize: 12, color: Colors.textSecondary, flex: 1, lineHeight: 18,
  },
  resetButton: {
    backgroundColor: Colors.amber, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 20, width: '100%',
  },
  resetButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelButton: {
    marginTop: 12, paddingVertical: 8,
  },
  cancelButtonText: {
    color: Colors.textSecondary, fontSize: 14, fontWeight: '500',
  },
});
