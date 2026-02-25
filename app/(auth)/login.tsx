import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { trackUserLogin } from '../../utils/analytics';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../lib/sharedStyles';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      const result = await signIn(email, password);
      if (!result.success) {
        // Check error code to determine if user account doesn't exist
        const isUserNotFound =
          result.errorCode === 'auth/user-not-found' ||
          result.errorCode === 'auth/invalid-credential' ||
          result.errorCode === 'auth/wrong-password';

        if (isUserNotFound) {
          Alert.alert(t('userNotFound'), t('wouldYouLikeToRegister'), [
            { text: t('cancel'), style: 'cancel' },
            {
              text: t('signUp'),
              onPress: () => router.push('/(auth)/register'),
            },
          ]);
        } else {
          Alert.alert(t('loginError'), result.error || t('somethingWentWrong'));
        }
        return;
      }

      // Track user login
      trackUserLogin();

      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>TruckinFox</Text>
          <Text style={styles.subtitle}>{t('signInToAccount')}</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('email')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={colors.text.secondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={colors.text.tertiary}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('password')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.text.secondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { paddingRight: 50 }]}
                placeholder={t('enterPassword')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor={colors.text.tertiary}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberMe}
              onPress={() => setRememberMe(!rememberMe)}
              accessibilityRole="checkbox"
              accessibilityLabel="Remember me"
              accessibilityState={{ checked: rememberMe }}
              accessibilityHint="Keep me logged in on this device"
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Ionicons name="checkmark" size={16} color={colors.white} />}
              </View>
              <Text style={styles.rememberText}>{t('rememberMe')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
              accessibilityHint="Reset your password"
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={styles.forgotPassword}>{t('forgotPassword')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Log in"
            accessibilityHint="Sign in to your account"
            accessibilityState={{ disabled: loading }}
          >
            <Text style={styles.loginButtonText}>
              {loading ? t('signingIn') : t('signInButton')}
            </Text>
          </TouchableOpacity>

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>{t('noAccount')} </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
              accessibilityRole="button"
              accessibilityLabel="Sign up"
              accessibilityHint="Create a new account"
            >
              <Text style={styles.signUpLink}>{t('signUp')}</Text>
            </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  formContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.xl,
    marginBottom: spacing.xl,
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
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 44,
    paddingLeft: 44,
    paddingRight: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    fontSize: fontSize.md,
    backgroundColor: colors.white,
    color: colors.text.primary,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    padding: spacing.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: spacing.xs,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  forgotPassword: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  loginButton: {
    backgroundColor: colors.primary,
    height: 44,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  signUpLink: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
});
