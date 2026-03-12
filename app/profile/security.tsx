import React, { useState, type ComponentProps } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../lib/sharedStyles';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ScreenHeader } from '../../components/ScreenHeader';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type SecurityOption = {
  id: string;
  icon: IoniconName;
  title: string;
  subtitle: string;
  iconColor: string;
  onPress: () => void;
};

export default function SecurityScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, signOut, signOutAllDevices, deleteAccount } = useAuth();
  const [loading, setLoading] = useState(false);

  // Password change state
  const [pwStep, setPwStep] = useState<'idle' | 'open' | 'saving'>('idle');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // Delete account state
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const [deletePassword, setDeletePassword] = useState('');

  const handleSignOut = async () => {
    Alert.alert(t('signOut'), t('confirmSignOut'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            const result = await signOut();
            if (result.success) {
              router.replace('/(auth)/login');
            } else {
              Alert.alert(t('error'), result.error || t('somethingWentWrong'));
            }
          } catch (error) {
            console.error('Sign out error:', error);
            Alert.alert(t('error'), t('somethingWentWrong'));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleSignOutAllDevices = async () => {
    Alert.alert(t('signOutAllDevices'), t('signOutAllConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            const result = await signOutAllDevices();
            if (result.success) {
              router.replace('/(auth)/login');
            } else {
              Alert.alert(t('error'), result.error || t('somethingWentWrong'));
            }
          } catch (error) {
            console.error('Sign out all devices error:', error);
            Alert.alert(t('error'), t('somethingWentWrong'));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const resetPwForm = () => {
    setPwStep('idle');
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
  };

  const handleChangePassword = async () => {
    if (!currentPw.trim() || !newPw.trim()) {
      Alert.alert(t('error'), t('enterPassword'));
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert(t('error'), t('passwordMismatch'));
      return;
    }
    if (newPw.length < 8) {
      Alert.alert(t('error'), t('passwordTooShort'));
      return;
    }

    try {
      setPwStep('saving');

      // Re-authenticate to verify current password
      const email = user?.email;
      if (!email) throw new Error('No email');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPw,
      });

      if (signInError) {
        setPwStep('open');
        Alert.alert(t('error'), t('invalidCredentials'));
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
      if (updateError) throw updateError;

      resetPwForm();
      Alert.alert(t('passwordChanged'), '');
    } catch (err) {
      setPwStep('open');
      Alert.alert(
        t('error'),
        err instanceof Error ? err.message : t('somethingWentWrong')
      );
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('deleteAccountTitle'), t('deleteAccountWarning'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteAccountConfirm'),
        style: 'destructive',
        onPress: () => setDeleteStep('confirm'),
      },
    ]);
  };

  const handleDeleteConfirmWithPassword = async () => {
    if (!deletePassword.trim()) {
      Alert.alert(t('error'), t('deleteAccountPassword'));
      return;
    }

    try {
      setDeleteStep('deleting');

      const email = user?.email;
      if (!email) throw new Error('No email');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: deletePassword,
      });

      if (signInError) {
        setDeleteStep('confirm');
        Alert.alert(t('error'), t('invalidCredentials'));
        return;
      }

      const result = await deleteAccount();
      if (result.success) {
        Alert.alert(t('accountDeleted'), '', [
          { text: 'OK', onPress: () => router.replace('/(auth)/login') },
        ]);
      } else {
        setDeleteStep('idle');
        Alert.alert(t('error'), result.error ?? t('somethingWentWrong'));
      }
    } catch {
      setDeleteStep('idle');
      Alert.alert(t('error'), t('somethingWentWrong'));
    } finally {
      setDeletePassword('');
    }
  };

  const otherSecurityOptions: SecurityOption[] = [
    {
      id: 'active-sessions',
      icon: 'phone-portrait-outline',
      title: t('activeSessions'),
      subtitle: t('activeSessionsSubtitle'),
      iconColor: colors.info,
      onPress: () => Alert.alert(t('comingSoon'), t('comingSoon')),
    },
  ];

  const signOutOptions: SecurityOption[] = [
    {
      id: 'sign-out',
      icon: 'log-out-outline',
      title: t('signOut'),
      subtitle: t('signOutThisDeviceSubtitle'),
      iconColor: colors.status.warning,
      onPress: handleSignOut,
    },
    {
      id: 'sign-out-all',
      icon: 'exit-outline',
      title: t('signOutAllDevices'),
      subtitle: t('signOutAllDevicesSubtitle'),
      iconColor: colors.error,
      onPress: handleSignOutAllDevices,
    },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('security')} onBackPress={() => router.back()} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* User Info */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={32} color={colors.white} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* Security Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('securitySettings')}</Text>
          <View style={styles.card}>
            {/* Change Password — expandable inline */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => setPwStep(s => (s === 'idle' ? 'open' : 'idle'))}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={t('changePassword')}
              accessibilityState={{ expanded: pwStep !== 'idle' }}
            >
              <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="key-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>{t('changePassword')}</Text>
                <Text style={styles.optionSubtitle}>{t('changePasswordSubtitle')}</Text>
              </View>
              <Ionicons
                name={pwStep !== 'idle' ? 'chevron-up' : 'chevron-forward'}
                size={20}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>

            {/* Inline password form */}
            {pwStep !== 'idle' && (
              <View style={styles.pwFormPanel}>
                <TextInput
                  style={styles.pwInput}
                  placeholder={t('currentPassword')}
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry
                  value={currentPw}
                  onChangeText={setCurrentPw}
                  editable={pwStep !== 'saving'}
                  autoCapitalize="none"
                  textContentType="password"
                />
                <TextInput
                  style={styles.pwInput}
                  placeholder={t('newPassword')}
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry
                  value={newPw}
                  onChangeText={setNewPw}
                  editable={pwStep !== 'saving'}
                  autoCapitalize="none"
                  textContentType="newPassword"
                />
                <TextInput
                  style={styles.pwInput}
                  placeholder={t('confirmNewPassword')}
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry
                  value={confirmPw}
                  onChangeText={setConfirmPw}
                  editable={pwStep !== 'saving'}
                  autoCapitalize="none"
                  textContentType="newPassword"
                />
                {pwStep === 'saving' ? (
                  <ActivityIndicator color={colors.primary} style={styles.pwSpinner} />
                ) : (
                  <View style={styles.pwActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={resetPwForm}>
                      <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.pwSaveBtn} onPress={handleChangePassword}>
                      <Text style={styles.pwSaveBtnText}>{t('changePassword')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Remaining security options */}
            {otherSecurityOptions.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionItem,
                  index === otherSecurityOptions.length - 1 && styles.optionItemLast,
                ]}
                onPress={option.onPress}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={option.title}
              >
                <View style={[styles.iconCircle, { backgroundColor: `${option.iconColor}15` }]}>
                  <Ionicons name={option.icon} size={24} color={option.iconColor} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sign Out Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('accountActions')}</Text>
          <View style={styles.card}>
            {signOutOptions.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionItem,
                  index === signOutOptions.length - 1 && styles.optionItemLast,
                ]}
                onPress={option.onPress}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={option.title}
              >
                <View style={[styles.iconCircle, { backgroundColor: `${option.iconColor}15` }]}>
                  <Ionicons name={option.icon} size={24} color={option.iconColor} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                </View>
                {loading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Warning Card */}
        <View style={styles.warningCard}>
          <Ionicons name="information-circle" size={20} color={colors.status.warning} />
          <Text style={styles.warningText}>{t('securityWarning')}</Text>
        </View>

        {/* Delete Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('deleteAccount')}</Text>
          <View style={[styles.card, styles.dangerCard]}>
            {deleteStep === 'idle' && (
              <TouchableOpacity
                style={[styles.optionItem, styles.optionItemLast]}
                onPress={handleDeleteAccount}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={t('deleteAccount')}
              >
                <View style={[styles.iconCircle, { backgroundColor: `${colors.error}15` }]}>
                  <Ionicons name="trash-outline" size={24} color={colors.error} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, styles.dangerText]}>{t('deleteAccount')}</Text>
                  <Text style={styles.optionSubtitle}>{t('deleteAccountWarning').slice(0, 60)}…</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}

            {(deleteStep === 'confirm' || deleteStep === 'deleting') && (
              <View style={styles.deleteConfirmPanel}>
                <Text style={styles.deleteConfirmTitle}>{t('deleteAccountTitle')}</Text>
                <Text style={styles.deleteConfirmWarning}>{t('deleteAccountWarning')}</Text>
                <TextInput
                  style={styles.passwordInput}
                  placeholder={t('deleteAccountPassword')}
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  editable={deleteStep !== 'deleting'}
                  autoCapitalize="none"
                />
                {deleteStep === 'deleting' ? (
                  <ActivityIndicator color={colors.error} style={{ marginTop: spacing.md }} />
                ) : (
                  <View style={styles.deleteActions}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => { setDeleteStep('idle'); setDeletePassword(''); }}
                    >
                      <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={handleDeleteConfirmWithPassword}
                    >
                      <Text style={styles.deleteBtnText}>{t('deleteAccountConfirm')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xxxs,
  },
  userEmail: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.white,
    ...Platform.select({
      ios: shadows.sm,
      android: { elevation: 1 },
    }),
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  optionItemLast: {
    borderBottomWidth: 0,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xxxs,
  },
  optionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  // Password change form
  pwFormPanel: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  pwInput: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
    backgroundColor: colors.background,
  },
  pwSpinner: {
    marginTop: spacing.sm,
  },
  pwActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pwSaveBtn: {
    flex: 2,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  pwSaveBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  // Warning card
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${colors.status.warning}10`,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.status.warning,
    marginBottom: spacing.lg,
  },
  warningText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    lineHeight: 20,
  },
  // Delete account
  dangerCard: {
    borderWidth: 1,
    borderColor: `${colors.error}30`,
  },
  dangerText: {
    color: colors.error,
  },
  deleteConfirmPanel: {
    padding: spacing.lg,
  },
  deleteConfirmTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  deleteConfirmWarning: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: `${colors.error}50`,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
    backgroundColor: `${colors.error}06`,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  deleteBtn: {
    flex: 2,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
});
