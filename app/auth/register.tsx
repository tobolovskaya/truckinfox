import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { TextInput, Text, RadioButton } from 'react-native-paper';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { IOSButton } from '../../components/IOSButton';
import { colors, spacing } from '../../theme';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'customer' | 'carrier'>('customer');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const handleRegister = async () => {
    if (!email || !password || !displayName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      await signUp(email, password, displayName, role);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>🚚</Text>
          <Text style={styles.title}>{t('auth.register')}</Text>
          <Text style={styles.subtitle}>Join TruckinFox today</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label={t('auth.displayName')}
            value={displayName}
            onChangeText={setDisplayName}
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
          />

          <TextInput
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
          />

          <TextInput
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
          />

          <TextInput
            label={t('auth.confirmPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            mode="outlined"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
          />

          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>{t('auth.role')}</Text>
            <RadioButton.Group
              onValueChange={value => setRole(value as 'customer' | 'carrier')}
              value={role}
            >
              <View style={styles.radioItem}>
                <RadioButton.Android value="customer" color={colors.primary} />
                <Text>{t('auth.customer')}</Text>
              </View>
              <View style={styles.radioItem}>
                <RadioButton.Android value="carrier" color={colors.primary} />
                <Text>{t('auth.carrier')}</Text>
              </View>
            </RadioButton.Group>
          </View>

          <IOSButton
            title={loading ? 'Creating account...' : t('auth.register')}
            onPress={handleRegister}
            disabled={loading}
            style={styles.registerButton}
          />

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>{t('auth.alreadyHaveAccount')} </Text>
            <Link href="/auth/login" asChild>
              <Text style={styles.loginLink}>{t('auth.login')}</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 60,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
  roleContainer: {
    marginBottom: spacing.lg,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  registerButton: {
    marginBottom: spacing.md,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  loginText: {
    color: colors.textSecondary,
  },
  loginLink: {
    color: colors.primary,
    fontWeight: 'bold',
  },
});
