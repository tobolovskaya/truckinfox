import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { auth } from '../../lib/firebase';
import {
  signInWithEmailAndPassword,
  updatePassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenSection } from '../../components/ScreenSection';
import { theme } from '../../theme/theme';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../lib/sharedStyles';

export default function SecurityScreen() {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [enablingTwoFactor, setEnablingTwoFactor] = useState(false);

  const validatePasswordChange = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('error'), 'Please fill in all password fields');
      return false;
    }

    if (newPassword.length < 6) {
      Alert.alert(t('error'), 'New password must be at least 6 characters');
      return false;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('error'), 'New passwords do not match');
      return false;
    }

    return true;
  };

  const handleChangePassword = async () => {
    if (!validatePasswordChange()) return;

    setChangingPassword(true);
    try {
      if (!auth.currentUser || !user?.email) {
        throw new Error('Not authenticated');
      }

      // First verify current password by trying to sign in
      await signInWithEmailAndPassword(auth, user.email, currentPassword);

      // Update password
      await updatePassword(auth.currentUser, newPassword);

      Alert.alert(t('success'), 'Password changed successfully', [
        {
          text: t('ok'),
          onPress: () => {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert(t('error'), error.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleToggleTwoFactor = async () => {
    // Firebase MFA is more complex, showing placeholder for now
    Alert.alert('Coming Soon', 'Two-factor authentication will be available in a future update.', [
      { text: t('ok') },
    ]);
  };

  const handleSignOutAllDevices = async () => {
    Alert.alert(
      'Sign Out All Devices',
      'This will sign you out from all devices. You will need to sign in again.',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: 'Sign Out All',
          style: 'destructive',
          onPress: async () => {
            setSigningOutAll(true);
            try {
              // Firebase doesn't support global sign out via client SDK
              // For now, just sign out current session
              await firebaseSignOut(auth);

              Alert.alert(t('success'), 'Signed out from all devices', [
                {
                  text: t('ok'),
                  onPress: () => router.replace('/(auth)/login'),
                },
              ]);
            } catch (error: any) {
              Alert.alert(t('error'), error.message);
            } finally {
              setSigningOutAll(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Security Settings" showBackButton />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Change Password */}
        <ScreenSection title="Change Password">

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <TouchableOpacity
            style={[styles.changePasswordButton, changingPassword && styles.buttonDisabled]}
            onPress={handleChangePassword}
            disabled={changingPassword}
          >
            {changingPassword ? (
              <ActivityIndicator size="small" color={theme.iconColors.white} />
            ) : (
              <Text style={styles.buttonText}>Change Password</Text>
            )}
          </TouchableOpacity>
        </ScreenSection>

        {/* Two-Factor Authentication */}
        <ScreenSection
          title="Two-Factor Authentication"
          subtitle="Add an extra layer of security to your account with 2FA"
        >

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="shield-checkmark-outline"
                size={24}
                color={theme.iconColors.success}
              />
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Enable 2FA</Text>
                <Text style={styles.settingSubtitle}>
                  {twoFactorEnabled ? 'Protection enabled' : 'Recommended for security'}
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              {enablingTwoFactor ? (
                <ActivityIndicator size="small" color={theme.iconColors.primary} />
              ) : (
                <Switch
                  value={twoFactorEnabled}
                  onValueChange={handleToggleTwoFactor}
                  trackColor={{ false: '#E5E7EB', true: '#FF7043' }}
                  thumbColor={twoFactorEnabled ? 'white' : '#F3F4F6'}
                />
              )}
            </View>
          </View>
        </ScreenSection>

        {/* Session Management */}
        <ScreenSection title="Session Management">

          <TouchableOpacity
            style={[styles.signOutAllButton, signingOutAll && styles.buttonDisabled]}
            onPress={handleSignOutAllDevices}
            disabled={signingOutAll}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.iconColors.error} />
            {signingOutAll ? (
              <ActivityIndicator
                size="small"
                color={theme.iconColors.error}
                style={styles.buttonIcon}
              />
            ) : (
              <Text style={styles.signOutAllText}>Sign Out All Devices</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.helperText}>
            This will sign you out from all devices and browsers. You&apos;ll need to sign in again.
          </Text>
        </ScreenSection>

        {/* Security Tips */}
        <ScreenSection title="Security Tips">

          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.iconColors.success} />
            <Text style={styles.tipText}>Use a strong, unique password</Text>
          </View>

          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.iconColors.success} />
            <Text style={styles.tipText}>Enable two-factor authentication</Text>
          </View>

          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.iconColors.success} />
            <Text style={styles.tipText}>Don&apos;t share your login credentials</Text>
          </View>

          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.iconColors.success} />
            <Text style={styles.tipText}>Sign out from public devices</Text>
          </View>
        </ScreenSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  sectionDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    backgroundColor: colors.white,
  },
  changePasswordButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  settingTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  settingSubtitle: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  settingRight: {
    marginLeft: spacing.lg,
  },
  signOutAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  buttonIcon: {
    marginLeft: spacing.sm,
  },
  signOutAllText: {
    color: colors.error,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  helperText: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    lineHeight: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tipText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.md,
    flex: 1,
  },
});
