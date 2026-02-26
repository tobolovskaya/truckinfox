import React, { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { PhoneAuthProvider, PhoneMultiFactorGenerator, multiFactor } from 'firebase/auth';
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
import { ScreenHeader } from '../../components/ScreenHeader';
import { auth } from '../../lib/firebase';

const RecaptchaModal = FirebaseRecaptchaVerifierModal as unknown as React.ComponentType<any>;

export default function SecurityScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, signOut, signOutAllDevices } = useAuth();
  const [loading, setLoading] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [isTwoFAEnabled, setIsTwoFAEnabled] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  };

  const isRecaptchaConfigReady =
    !!firebaseConfig.apiKey &&
    !!firebaseConfig.authDomain &&
    !!firebaseConfig.projectId &&
    !!firebaseConfig.appId;

  useEffect(() => {
    if (user?.phoneNumber) {
      setPhoneNumber(user.phoneNumber);
    }

    if (auth.currentUser) {
      setIsTwoFAEnabled(multiFactor(auth.currentUser).enrolledFactors.length > 0);
    }
  }, [user?.phoneNumber]);

  const enable2FA = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(t('error'), 'Two-factor authentication setup is supported on mobile only.');
      return;
    }

    if (!isRecaptchaConfigReady) {
      Alert.alert(t('error'), 'Firebase reCAPTCHA configuration is incomplete.');
      return;
    }

    if (!auth.currentUser) {
      Alert.alert(t('error'), t('somethingWentWrong'));
      return;
    }

    if (!phoneNumber) {
      Alert.alert(t('error'), 'No phone number found on your account.');
      return;
    }

    if (!recaptchaVerifier.current) {
      Alert.alert(t('error'), 'reCAPTCHA verifier is not ready yet. Please try again.');
      return;
    }

    try {
      setTwoFALoading(true);
      const session = await multiFactor(auth.currentUser).getSession();

      const phoneInfoOptions = {
        phoneNumber,
        session,
      };

      const provider = new PhoneAuthProvider(auth);
      const nextVerificationId = await provider.verifyPhoneNumber(
        phoneInfoOptions,
        recaptchaVerifier.current
      );

      setVerificationId(nextVerificationId);
      Alert.alert(t('twoFactorAuth'), 'Verification code sent. Enter it below to finish setup.');
    } catch (error) {
      console.error('Failed to start 2FA enrollment:', error);
      Alert.alert(t('error'), 'Unable to start two-factor setup. Please try again.');
    } finally {
      setTwoFALoading(false);
    }
  };

  const confirm2FA = async () => {
    if (!auth.currentUser || !verificationId) {
      Alert.alert(t('error'), t('somethingWentWrong'));
      return;
    }

    if (!verificationCode.trim()) {
      Alert.alert(t('error'), 'Please enter the verification code.');
      return;
    }

    try {
      setTwoFALoading(true);
      const phoneCredential = PhoneAuthProvider.credential(verificationId, verificationCode.trim());
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(phoneCredential);

      await multiFactor(auth.currentUser).enroll(multiFactorAssertion, 'primary-phone');

      setIsTwoFAEnabled(true);
      setVerificationId(null);
      setVerificationCode('');
      Alert.alert(t('twoFactorAuth'), 'Two-factor authentication enabled successfully.');
    } catch (error) {
      console.error('Failed to confirm 2FA enrollment:', error);
      Alert.alert(t('error'), 'Invalid verification code. Please try again.');
    } finally {
      setTwoFALoading(false);
    }
  };

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

  type IoniconName = ComponentProps<typeof Ionicons>['name'];
  type SecurityOption = {
    id: string;
    icon: IoniconName;
    title: string;
    subtitle: string;
    iconColor: string;
    onPress: () => void;
  };

  const securityOptions: SecurityOption[] = [
    {
      id: 'change-password',
      icon: 'key-outline',
      title: t('changePassword'),
      subtitle: t('changePasswordSubtitle'),
      iconColor: colors.primary,
      onPress: () => {
        Alert.alert(t('comingSoon'), 'Change password feature coming soon');
      },
    },
    {
      id: 'two-factor',
      icon: 'shield-checkmark-outline',
      title: t('twoFactorAuth'),
      subtitle: isTwoFAEnabled
        ? t('enabled') || 'Enabled'
        : t('twoFactorSubtitle') || 'Add extra security to your account',
      iconColor: colors.success,
      onPress: enable2FA,
    },
    {
      id: 'active-sessions',
      icon: 'phone-portrait-outline',
      title: t('activeSessions'),
      subtitle: t('activeSessionsSubtitle'),
      iconColor: colors.info,
      onPress: () => {
        Alert.alert(t('comingSoon'), 'Active sessions management coming soon');
      },
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
      {isRecaptchaConfigReady ? (
        <RecaptchaModal
          ref={recaptchaVerifier}
          firebaseConfig={firebaseConfig}
          attemptInvisibleVerification
        />
      ) : null}

      <ScreenHeader title={t('security')} onBackPress={() => router.back()} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
            {securityOptions.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionItem,
                  index === securityOptions.length - 1 && styles.optionItemLast,
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

        {verificationId ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('twoFactorAuth')}</Text>
            <View style={styles.card}>
              <View style={styles.verificationContainer}>
                <Text style={styles.verificationText}>Enter SMS verification code</Text>
                <TextInput
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="123456"
                  placeholderTextColor={colors.text.tertiary}
                  style={styles.verificationInput}
                  maxLength={6}
                />
                <TouchableOpacity
                  style={[styles.confirmButton, twoFALoading && styles.confirmButtonDisabled]}
                  onPress={confirm2FA}
                  disabled={twoFALoading}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm two-factor authentication"
                >
                  {twoFALoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.confirmButtonText}>Confirm code</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

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
  verificationContainer: {
    padding: spacing.lg,
  },
  verificationText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  verificationInput: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.lg,
    color: colors.text.primary,
    marginBottom: spacing.md,
    letterSpacing: 2,
  },
  confirmButton: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${colors.status.warning}10`,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.status.warning,
  },
  warningText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    lineHeight: 20,
  },
});
