import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { TextInput, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { IOSButton } from '../../components/IOSButton';
import { colors, spacing } from '../../theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await resetPassword(email);
      Alert.alert('Success', 'Password reset email sent. Please check your inbox.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{t('auth.resetPassword')}</Text>
        <Text style={styles.description}>
          Enter your email address and we'll send you a link to reset your password.
        </Text>

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

        <IOSButton
          title={loading ? 'Sending...' : 'Send Reset Link'}
          onPress={handleResetPassword}
          disabled={loading}
          style={styles.button}
        />

        <IOSButton title="Back to Login" onPress={() => router.back()} variant="text" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  input: {
    marginBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  button: {
    marginBottom: spacing.md,
  },
});
