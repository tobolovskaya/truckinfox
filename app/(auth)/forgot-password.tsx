import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { TextInput, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useTranslation } from 'react-i18next';
import { IOSButton } from '../../components/IOSButton';
import { theme } from '../../theme/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Success', 'Password reset email sent. Please check your inbox.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send reset email';
      Alert.alert('Error', errorMessage);
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
          outlineColor={theme.colors.outline}
          activeOutlineColor={theme.colors.primary}
        />

        <IOSButton
          title={loading ? 'Sending...' : 'Send Reset Link'}
          onPress={handleResetPassword}
          disabled={loading}
          style={styles.button}
        />

        <IOSButton title="Back to Login" onPress={() => router.back()} variant="secondary" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  input: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  button: {
    marginBottom: theme.spacing.md,
  },
});
