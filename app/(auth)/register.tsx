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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme/theme';
import { trackUserRegistered } from '../../utils/analytics';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows, gradients } from '../../lib/sharedStyles';


export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    userType: 'customer' as 'customer' | 'carrier',
    companyName: '',
    orgNumber: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signUp } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const handleRegister = async () => {
    if (!formData.email || !formData.password || !formData.fullName || !formData.phone) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert(t('error'), t('passwordsDoNotMatch'));
      return;
    }

    if (formData.userType === 'carrier' && (!formData.companyName || !formData.orgNumber)) {
      Alert.alert(t('error'), t('fillBusinessFields'));
      return;
    }

    if (!acceptTerms) {
      Alert.alert(t('error'), t('acceptTerms'));
      return;
    }

    setLoading(true);
    try {
      await signUp(formData);
      
      // Track user registration
      trackUserRegistered({
        account_type: formData.userType === 'carrier' ? 'business' : 'private',
        registration_method: 'email',
      });
      
      Alert.alert(t('success'), t('accountCreated'), [
        { text: t('ok'), onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error: any) {
      Alert.alert(t('error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <LinearGradient
      colors={gradients.primary}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.iconColors.primary} />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Ionicons name="car-sport" size={40} color={theme.iconColors.white} />
          </View>
          <Text style={styles.title}>TruckinFox</Text>
          <Text style={styles.subtitle}>{t('createAccount')}</Text>
        </View>

        {/* Registration Form */}
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{t('registration')}</Text>
            <Text style={styles.formSubtitle}>{t('fillFormToCreateAccount')}</Text>
          </View>

          {/* User Type Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('accountType')}</Text>
            <View style={styles.userTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.userTypeCard,
                  formData.userType === 'customer' && styles.userTypeCardActive
                ]}
                onPress={() => updateFormData('userType', 'customer')}
              >
                <Ionicons
                  name="person-outline"
                  size={24}
                  color={formData.userType === 'customer' ? colors.primary : colors.text.secondary}
                />
                <Text style={[
                  styles.userTypeText,
                  formData.userType === 'customer' && styles.userTypeTextActive
                ]}>
                  {t('private')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.userTypeCard,
                  formData.userType === 'carrier' && styles.userTypeCardActive
                ]}
                onPress={() => updateFormData('userType', 'carrier')}
              >
                <Ionicons
                  name="business-outline"
                  size={24}
                  color={formData.userType === 'carrier' ? colors.primary : colors.text.secondary}
                />
                <Text style={[
                  styles.userTypeText,
                  formData.userType === 'carrier' && styles.userTypeTextActive
                ]}>
                  {t('business')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Full Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('fullName')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={theme.iconColors.gray.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('enterFullName')}
                value={formData.fullName}
                onChangeText={(value) => updateFormData('fullName', value)}
                placeholderTextColor={colors.text.tertiary}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('email')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={theme.iconColors.gray.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                value={formData.email}
                onChangeText={(value) => updateFormData('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={colors.text.tertiary}
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('phone')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color={theme.iconColors.gray.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="+47 123 45 678"
                value={formData.phone}
                onChangeText={(value) => updateFormData('phone', value)}
                keyboardType="phone-pad"
                placeholderTextColor={colors.text.tertiary}
              />
            </View>
          </View>

          {/* Business Fields */}
          {formData.userType === 'carrier' && (
            <View style={styles.businessSection}>
              <Text style={styles.businessTitle}>{t('businessInformation')}</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('companyName')}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="business-outline" size={20} color={theme.iconColors.gray.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t('enterCompanyName')}
                    value={formData.companyName}
                    onChangeText={(value) => updateFormData('companyName', value)}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('orgNumber')}</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="document-text-outline" size={20} color={theme.iconColors.gray.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="123 456 789"
                    value={formData.orgNumber}
                    onChangeText={(value) => updateFormData('orgNumber', value)}
                    keyboardType="numeric"
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('password')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.iconColors.gray.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 50 }]}
                placeholder={t('enterPassword')}
                value={formData.password}
                onChangeText={(value) => updateFormData('password', value)}
                secureTextEntry={!showPassword}
                placeholderTextColor={colors.text.tertiary}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={theme.iconColors.gray.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('confirmPassword')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.iconColors.gray.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { paddingRight: 50 }]}
                placeholder={t('confirmPassword')}
                value={formData.confirmPassword}
                onChangeText={(value) => updateFormData('confirmPassword', value)}
                secureTextEntry={!showConfirmPassword}
                placeholderTextColor={colors.text.tertiary}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={theme.iconColors.gray.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Terms and Conditions */}
          <View style={styles.termsContainer}>
            <TouchableOpacity
              style={styles.termsCheckbox}
              onPress={() => setAcceptTerms(!acceptTerms)}
            >
              <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
                {acceptTerms && <Ionicons name="checkmark" size={16} color={theme.iconColors.white} />}
              </View>
              <Text style={styles.termsText}>
                {t('iAgreeToThe')} <Text style={styles.termsLink}>{t('termsOfService')}</Text> {t('and')} <Text style={styles.termsLink}>{t('privacyPolicy')}</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.registerButtonText}>
              {loading ? t('creatingAccount') : t('signUp')}
            </Text>
          </TouchableOpacity>

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>{t('alreadyHaveAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.signInLink}>{t('signIn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  logoContainer: {
    width: 60,
    height: 60,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.lg,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: gradients.primary[1],
  },
  formHeader: {
    marginBottom: spacing.lg,
  },
  formTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  formSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  inputContainer: {
    marginBottom: spacing.md,
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
    height: 42,
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
  userTypeContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  userTypeCard: {
    flex: 1,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border.light,
    borderRadius: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  userTypeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  userTypeText: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  userTypeTextActive: {
    color: colors.primary,
  },
  businessSection: {
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: gradients.primary[1],
  },
  businessTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  termsContainer: {
    marginBottom: spacing.xl,
  },
  termsCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: spacing.xs,
    marginRight: spacing.md,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  registerButton: {
    backgroundColor: colors.primary,
    height: 44,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...shadows.primary,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  signInLink: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
});
