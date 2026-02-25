import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenSection } from '../../components/ScreenSection';
import AvatarUpload from '../../components/AvatarUpload';
import { IOSButton } from '../../components/IOSButton';
import { generateSearchTerms } from '../../utils/search';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../lib/sharedStyles';
import { sanitizeInput } from '../../utils/sanitization';

type UserProfile = {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  orgNumber: string;
  avatarUrl: string;
  userType: 'customer' | 'carrier' | '';
};

const emptyProfile: UserProfile = {
  fullName: '',
  email: '',
  phone: '',
  companyName: '',
  orgNumber: '',
  avatarUrl: '',
  userType: '',
};

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => {
    return profile.fullName.trim().length > 1 && profile.phone.trim().length > 5;
  }, [profile.fullName, profile.phone]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, 'users', user.uid));
        const data = snapshot.exists() ? snapshot.data() : null;

        setProfile({
          fullName: (data?.full_name as string) || user.displayName || '',
          email: (data?.email as string) || user.email || '',
          phone: (data?.phone as string) || '',
          companyName: (data?.company_name as string) || '',
          orgNumber: (data?.org_number as string) || '',
          avatarUrl: (data?.avatar_url as string) || user.photoURL || '',
          userType: (data?.user_type as 'customer' | 'carrier') || '',
        });
      } catch (error) {
        console.error('Failed to load profile:', error);
        Alert.alert(t('error'), t('somethingWentWrong'));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [t, user?.uid, user?.displayName, user?.email, user?.photoURL]);

  const handleSave = async () => {
    if (!user?.uid) return;

    if (!profile.fullName.trim() || !profile.phone.trim()) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    try {
      setSaving(true);
      // 🔐 Sanitize all user inputs
      const fullName = sanitizeInput(profile.fullName.trim(), 200);
      const phone = sanitizeInput(profile.phone.trim(), 20);
      const isBusinessAccount = profile.userType === 'carrier';
      const companyName = isBusinessAccount ? sanitizeInput(profile.companyName.trim(), 200) || null : null;
      const orgNumber = isBusinessAccount ? sanitizeInput(profile.orgNumber.trim(), 50) || null : null;

      await updateDoc(doc(db, 'users', user.uid), {
        full_name: fullName,
        phone,
        company_name: companyName,
        org_number: orgNumber,
        avatar_url: profile.avatarUrl || null,
        search_terms: generateSearchTerms(fullName),
        updated_at: new Date().toISOString(),
      });

      await updateProfile(user, {
        displayName: fullName,
        photoURL: profile.avatarUrl || null,
      });

      Alert.alert(t('success'), t('profileUpdated'));
    } catch (error) {
      console.error('Failed to save profile:', error);
      Alert.alert(t('error'), t('somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('editProfile')} />

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <ScreenSection noPadding>
              <View style={styles.avatarSection}>
                <AvatarUpload
                  avatarUrl={profile.avatarUrl}
                  onUpload={avatarUrl => setProfile(current => ({ ...current, avatarUrl }))}
                  size={96}
                />
                <Text style={styles.avatarHint}>{t('profile')}</Text>
              </View>
            </ScreenSection>

            <ScreenSection title={t('contactInformation')}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('fullName')}</Text>
                <TextInput
                  style={styles.input}
                  value={profile.fullName}
                  onChangeText={text => setProfile(current => ({ ...current, fullName: text }))}
                  placeholder={t('enterFullName')}
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('email')}</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={profile.email}
                  editable={false}
                  placeholder={t('enterEmailAddress')}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('phone')}</Text>
                <TextInput
                  style={styles.input}
                  value={profile.phone}
                  onChangeText={text => setProfile(current => ({ ...current, phone: text }))}
                  placeholder={t('phone')}
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="phone-pad"
                />
              </View>
            </ScreenSection>

            {profile.userType === 'carrier' && (
              <ScreenSection title={t('businessInformation')}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('companyName')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profile.companyName}
                    onChangeText={text =>
                      setProfile(current => ({ ...current, companyName: text }))
                    }
                    placeholder={t('enterCompanyName')}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('orgNumber')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profile.orgNumber}
                    onChangeText={text => setProfile(current => ({ ...current, orgNumber: text }))}
                    placeholder={t('orgNumber')}
                    placeholderTextColor={colors.text.tertiary}
                    keyboardType="number-pad"
                  />
                </View>
              </ScreenSection>
            )}

            <ScreenSection title={t('accountType')}>
              <View style={styles.accountTypeRow}>
                <Text style={styles.accountTypeLabel}>{t('accountType')}</Text>
                <View style={styles.accountTypePill}>
                  <Text style={styles.accountTypeText}>
                    {profile.userType === 'carrier' ? t('carrier') : t('customer')}
                  </Text>
                </View>
              </View>
            </ScreenSection>

            <View style={styles.saveSection}>
              <IOSButton
                title={t('save')}
                onPress={handleSave}
                loading={saving}
                disabled={!canSave || saving}
                fullWidth
                size="large"
                icon="checkmark"
                hapticFeedback="medium"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
    paddingBottom: spacing.huge,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatarHint: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  inputDisabled: {
    backgroundColor: colors.backgroundLight,
    color: colors.text.tertiary,
  },
  accountTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountTypeLabel: {
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  accountTypePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: `${colors.primary}15`,
    borderRadius: borderRadius.full,
  },
  accountTypeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  saveSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
});
