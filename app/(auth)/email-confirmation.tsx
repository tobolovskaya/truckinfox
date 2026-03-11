import React, { useState } from 'react';
import {
  View,
  Text,
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

export default function EmailConfirmationScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) {
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) {
        throw error;
      }
      setResent(true);
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : t('somethingWentWrong'));
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <BrandLogo size="sm" />

        <View style={styles.iconWrapper}>
          <Ionicons name="mail-open-outline" size={64} color={colors.primary} />
        </View>

        <Text style={styles.title}>{t('checkYourEmail')}</Text>
        <Text style={styles.body}>
          {t('confirmationSentTo')}
        </Text>
        {!!email && <Text style={styles.emailText}>{email}</Text>}
        <Text style={styles.body}>{t('clickLinkToConfirm')}</Text>

        {resent ? (
          <View style={styles.resentBadge}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.success ?? '#22c55e'} />
            <Text style={styles.resentText}>{t('emailResent')}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.secondaryButton, resending && styles.buttonDisabled]}
            onPress={handleResend}
            disabled={resending}
          >
            {resending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>{t('resendEmail')}</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.primaryButtonText}>{t('goToLogin')}</Text>
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
  emailText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  resentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  resentText: {
    fontSize: fontSize.sm,
    color: colors.success ?? '#22c55e',
    fontWeight: fontWeight.semibold,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    alignSelf: 'stretch',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
