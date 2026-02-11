import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
 Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { db, auth } from '../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile as updateAuthProfile } from 'firebase/auth';
import AvatarUpload from '../../components/AvatarUpload';
import { theme } from '../../theme/theme';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../../lib/sharedStyles';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  user_type: string;
  company_name?: string;
  org_number?: string;
  avatar_url?: string;
  city?: string;
  region?: string;
  vehicle_type?: string;
  vehicle_capacity?: number;
  vehicle_description?: string;
  show_phone_publicly?: boolean;
  show_email_publicly?: boolean;
  bio?: string;
}

export default function EditProfileScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    company_name: '',
    org_number: '',
    city: '',
    region: '',
    vehicle_type: '',
    vehicle_capacity: '',
    vehicle_description: '',
    bio: '',
  });
  
  const [privacySettings, setPrivacySettings] = useState({
    show_phone_publicly: false,
    show_email_publicly: false,
  });

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      if (!user?.uid) return;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error('Profile not found');
      }
      
      const data = { id: userSnap.id, ...userSnap.data() } as UserProfile;
      
      setProfile(data);
      setFormData({
        full_name: data.full_name || '',
        phone: data.phone || '',
        company_name: data.company_name || '',
        org_number: data.org_number || '',
        city: data.city || '',
        region: data.region || '',
        vehicle_type: data.vehicle_type || '',
        vehicle_capacity: data.vehicle_capacity?.toString() || '',
        vehicle_description: data.vehicle_description || '',
        bio: data.bio || '',
      });
      setPrivacySettings({
        show_phone_publicly: data.show_phone_publicly || false,
        show_email_publicly: data.show_email_publicly || false,
      });
      setAvatarUrl(data.avatar_url || '');
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert(t('error'), 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.full_name.trim()) {
      Alert.alert(t('error'), t('fullName') + ' ' + t('titleRequired').toLowerCase());
      return false;
    }
    if (!formData.phone.trim()) {
      Alert.alert(t('error'), t('phone') + ' ' + t('titleRequired').toLowerCase());
      return false;
    }
    if (profile?.user_type === 'business') {
      if (!formData.company_name.trim()) {
        Alert.alert(t('error'), t('companyName') + ' ' + t('titleRequired').toLowerCase());
        return false;
      }
      if (!formData.org_number.trim()) {
        Alert.alert(t('error'), t('orgNumber') + ' ' + t('titleRequired').toLowerCase());
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (!user?.uid) return;
      
      // Update profile in database
      const updateData: any = {
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        updated_at: serverTimestamp(),
      };

      if (profile?.user_type === 'business') {
        updateData.company_name = formData.company_name.trim();
        updateData.org_number = formData.org_number.trim();
      }
      
      // Add extended fields
      updateData.city = formData.city.trim() || null;
      updateData.region = formData.region.trim() || null;
      updateData.bio = formData.bio.trim() || null;
      updateData.show_phone_publicly = privacySettings.show_phone_publicly;
      updateData.show_email_publicly = privacySettings.show_email_publicly;
      
      // Add vehicle info for carriers
      if (profile?.user_type === 'business') {
        updateData.vehicle_type = formData.vehicle_type || null;
        updateData.vehicle_capacity = formData.vehicle_capacity ? Number(formData.vehicle_capacity) : null;
        updateData.vehicle_description = formData.vehicle_description.trim() || null;
      }

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, updateData);

      // Update auth user profile
      if (auth.currentUser) {
        await updateAuthProfile(auth.currentUser, {
          displayName: formData.full_name.trim(),
        });
      }

      Alert.alert(
        t('success'),
        'Profile updated successfully',
        [
          {
            text: t('ok'),
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert(t('error'), error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.iconColors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.iconColors.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('editProfile')}</Text>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.iconColors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Avatar Upload */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <AvatarUpload
              avatarUrl={avatarUrl}
              onUpload={(url) => setAvatarUrl(url)}
              size={120}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.section}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('fullName')} *</Text>
            <TextInput
              style={styles.input}
              placeholder={t('enterFullName')}
              value={formData.full_name}
              onChangeText={(value) => updateFormData('full_name', value)}
              placeholderTextColor="#C7C7CD"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('phone')} *</Text>
            <TextInput
              style={styles.input}
              placeholder="+47 123 45 678"
              value={formData.phone}
              onChangeText={(value) => updateFormData('phone', value)}
              keyboardType="phone-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('email')}</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={profile?.email || ''}
              editable={false}
              placeholderTextColor="#9CA3AF"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell others about yourself..."
              value={formData.bio}
              onChangeText={(value) => updateFormData('bio', value)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={500}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Location Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          
          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                placeholder="Oslo"
                value={formData.city}
                onChangeText={(value) => updateFormData('city', value)}
                placeholderTextColor="#9CA3AF"
              />
            </View>
            
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Region</Text>
              <TextInput
                style={styles.input}
                placeholder="Oslo"
                value={formData.region}
                onChangeText={(value) => updateFormData('region', value)}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        </View>

        {/* Business Information */}
        {profile?.user_type === 'business' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('businessInformation')}</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('companyName')} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t('enterCompanyName')}
                value={formData.company_name}
                onChangeText={(value) => updateFormData('company_name', value)}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('orgNumber')} *</Text>
              <TextInput
                style={styles.input}
                placeholder="123 456 789"
                value={formData.org_number}
                onChangeText={(value) => updateFormData('org_number', value)}
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        )}

        {/* Vehicle Information (for business users) */}
        {profile?.user_type === 'business' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Vehicle Type</Text>
              <View style={styles.vehicleTypeGrid}>
                {[
                  { id: 'car', label: 'Car', icon: 'car-outline' },
                  { id: 'van', label: 'Van', icon: 'car-outline' },
                  { id: 'small_truck', label: 'Small Truck', icon: 'car-outline' },
                  { id: 'medium_truck', label: 'Medium Truck', icon: 'car-outline' },
                  { id: 'large_truck', label: 'Large Truck', icon: 'car-outline' },
                  { id: 'trailer', label: 'Trailer', icon: 'car-outline' },
                ].map((vehicle) => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[
                      styles.vehicleTypeCard,
                      formData.vehicle_type === vehicle.id && styles.vehicleTypeCardActive
                    ]}
                    onPress={() => updateFormData('vehicle_type', vehicle.id)}
                  >
                    <Ionicons
                      name={vehicle.icon as any}
                      size={20}
                      color={formData.vehicle_type === vehicle.id ? '#FF7043' : '#616161'}
                    />
                    <Text style={[
                      styles.vehicleTypeText,
                      formData.vehicle_type === vehicle.id && styles.vehicleTypeTextActive
                    ]}>
                      {vehicle.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Vehicle Capacity (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="1000"
                value={formData.vehicle_capacity}
                onChangeText={(value) => updateFormData('vehicle_capacity', value)}
                keyboardType="numeric"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Vehicle Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your vehicle, special equipment, etc."
                value={formData.vehicle_description}
                onChangeText={(value) => updateFormData('vehicle_description', value)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={300}
                placeholderTextColor="#9CA3AF"
              />
              </View>
          </View>
        )}

        {/* Privacy Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy Settings</Text>
          
          <View style={styles.privacyRow}>
            <View style={styles.privacyInfo}>
              <Text style={styles.privacyLabel}>Show phone publicly</Text>
              <Text style={styles.privacyDescription}>
                Allow other users to see your phone number in your profile
              </Text>
            </View>
            <Switch
              value={privacySettings.show_phone_publicly}
              onValueChange={(value) => setPrivacySettings(prev => ({ ...prev, show_phone_publicly: value }))}
              trackColor={{ false: '#E5E7EB', true: '#FF7043' }}
              thumbColor={privacySettings.show_phone_publicly ? 'white' : '#F3F4F6'}
            />
          </View>
          
          <View style={styles.privacyRow}>
            <View style={styles.privacyInfo}>
              <Text style={styles.privacyLabel}>Show email publicly</Text>
              <Text style={styles.privacyDescription}>
                Allow other users to see your email address in your profile
              </Text>
            </View>
            <Switch
              value={privacySettings.show_email_publicly}
              onValueChange={(value) => setPrivacySettings(prev => ({ ...prev, show_email_publicly: value }))}
              trackColor={{ false: '#E5E7EB', true: '#FF7043' }}
              thumbColor={privacySettings.show_email_publicly ? 'white' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Account Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Account Type</Text>
            <View style={styles.accountTypeContainer}>
              <Ionicons
                name={profile?.user_type === 'business' ? 'business' : 'person'}
                size={20}
                color={theme.iconColors.primary}
              />
              <Text style={styles.accountTypeText}>
                {profile?.user_type === 'business' ? t('business') : t('private')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.dark,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.lg,
  },
  saveButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.info,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.xxxl,
    marginHorizontal: spacing.lg,
  },
  inputContainer: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.medium,
  },
  label: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.normal,
    color: colors.text.dark,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  input: {
    fontSize: fontSize.lg,
    color: colors.text.dark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: 'transparent',
  },
  disabledInput: {
    color: colors.text.tertiary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  vehicleTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border.light,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
    marginBottom: spacing.sm,
  },
  vehicleTypeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundPrimary,
  },
  vehicleTypeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginLeft: 6,
  },
  vehicleTypeTextActive: {
    color: colors.primary,
  },
  privacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.medium,
    minHeight: 44,
  },
  privacyInfo: {
    flex: 1,
    marginRight: spacing.lg,
  },
  privacyLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.normal,
    color: colors.text.dark,
  },
  privacyDescription: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  helperText: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  accountTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  accountTypeText: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    textTransform: 'capitalize',
  },
  avatarSection: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
});
