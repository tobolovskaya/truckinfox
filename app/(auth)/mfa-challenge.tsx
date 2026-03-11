import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { BrandLogo } from '../../components/BrandLogo';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../lib/sharedStyles';
import { trackUserLogin } from '../../utils/analytics';

export default function MfaChallengeScreen() {
  const { factorId } = useLocalSearchParams<{ factorId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      Alert.alert(t('error'), t('enterSixDigitCode'));
      return;
    }
    if (!factorId) {
      Alert.alert(t('error'), t('somethingWentWrong'));
      return;
    }

    setLoading(true);
    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) {
        throw challengeError;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) {
        throw verifyError;
      }

      trackUserLogin();
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : t('invalidMfaCode'));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <BrandLogo size="sm" />

        <View style={styles.iconWrapper}>
          <Ionicons name="shield-checkmark-outline" size={64} color={colors.primary} />
        </View>

        <Text style={styles.title}>{t('twoFactorAuth')}</Text>
        <Text style={styles.body}>{t('enterCodeFromAuthApp')}</Text>

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={text => setCode(text.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          placeholderTextColor={colors.text.tertiary}
          textAlign="center"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.primaryButton, (loading || code.length !== 6) && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading || code.length !== 6}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>{t('verify')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.backButtonText}>{t('backToLogin')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  iconWrapper: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  body: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  codeInput: {
    width: 200,
    height: 56,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    fontSize: 28,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    backgroundColor: colors.white,
    letterSpacing: 8,
    marginVertical: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  backButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  backButtonText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
});
