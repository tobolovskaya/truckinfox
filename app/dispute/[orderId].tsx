import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../lib/sharedStyles';

type DisputeReason = 'damage' | 'not_delivered' | 'wrong_item' | 'payment' | 'other';

const REASONS: DisputeReason[] = ['damage', 'not_delivered', 'wrong_item', 'payment', 'other'];

export default function DisputeScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      Alert.alert(t('error'), t('disputeReasonRequired'));
      return;
    }
    if (!description.trim() || description.trim().length < 20) {
      Alert.alert(t('error'), t('disputeDescriptionMinLength'));
      return;
    }
    if (!user?.uid || !orderId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('disputes').insert({
        order_id: orderId,
        filed_by: user.uid,
        reason,
        description: description.trim(),
      });
      if (error) throw error;
      Alert.alert(t('success'), t('disputeFiled'), [
        { text: t('ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(t('error'), err instanceof Error ? err.message : t('somethingWentWrong'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('fileDispute')} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.infoText}>{t('disputeInfo')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('disputeReason')}</Text>
          {REASONS.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.reasonOption, reason === r && styles.reasonOptionActive]}
              onPress={() => setReason(r)}
              accessibilityRole="radio"
              accessibilityState={{ checked: reason === r }}
            >
              <View style={[styles.radio, reason === r && styles.radioActive]}>
                {reason === r && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.reasonText, reason === r && styles.reasonTextActive]}>
                {t(`disputeReason_${r}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('disputeDescription')}</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder={t('disputeDescriptionPlaceholder')}
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!reason || description.trim().length < 20 || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!reason || description.trim().length < 20 || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="flag-outline" size={20} color={colors.white} />
              <Text style={styles.submitButtonText}>{t('submitDispute')}</Text>
            </>
          )}
        </TouchableOpacity>
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
    padding: spacing.md,
    gap: spacing.md,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${colors.primary}10`,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  reasonOptionActive: {
    // no background change needed; radio fill handles it
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  reasonText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  reasonTextActive: {
    color: colors.text.primary,
    fontWeight: fontWeight.semibold,
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    backgroundColor: colors.white,
  },
  charCount: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'right',
  },
  submitButton: {
    backgroundColor: colors.status.error,
    borderRadius: borderRadius.sm,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
