import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useI18n } from '../../contexts/I18nContext';
import { db, storage } from '../../lib/firebase';
import {
  doc,
  updateDoc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { theme } from '../../theme/theme';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
  gradients,
} from '../../lib/sharedStyles';
import * as ImagePicker from 'expo-image-picker';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  user_type: string;
  company_name?: string;
  org_number?: string;
  rating: number;
  total_reviews: number;
  created_at: string;
  avatar_url?: string;
  city?: string;
  region?: string;
  vehicle_type?: string;
  vehicle_capacity?: number;
  vehicle_description?: string;
  show_phone_publicly?: boolean;
  show_email_publicly?: boolean;
  bio?: string;
  verified_carrier?: boolean;
  orders_as_customer?: number;
  orders_as_carrier?: number;
  total_transaction_amount?: number;
  last_activity_at?: string;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const { changeLanguage, currentLanguage } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [statistics, setStatistics] = useState({
    orders_as_customer: 0,
    orders_as_carrier: 0,
    total_transaction_amount: 0,
    last_activity_at: null,
  });
  const [notificationSettings, setNotificationSettings] = useState({
    notifications_enabled: true,
    new_orders_notifications: true,
    status_updates_notifications: true,
    bid_notifications: true,
    message_notifications: true,
  });

  useEffect(() => {
    fetchProfile();
    fetchNotificationSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      if (!user?.uid) return;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Create a new user profile if it doesn't exist
        const newUserData = {
          id: user.uid,
          email: user.email || '',
          full_name: user.displayName || 'User',
          phone: '',
          user_type: 'customer',
          rating: 0,
          total_reviews: 0,
          created_at: new Date().toISOString(),
          orders_as_customer: 0,
          orders_as_carrier: 0,
          total_transaction_amount: 0,
        };
        await setDoc(userRef, newUserData);
        setProfile(newUserData as UserProfile);
        setStatistics({
          orders_as_customer: 0,
          orders_as_carrier: 0,
          total_transaction_amount: 0,
          last_activity_at: null,
        });
      } else {
        const data = { id: userSnap.id, ...userSnap.data() } as UserProfile;
        setProfile(data);
        setAvatarUrl(data.avatar_url || '');
        setStatistics({
          orders_as_customer: data.orders_as_customer || 0,
          orders_as_carrier: data.orders_as_carrier || 0,
          total_transaction_amount: data.total_transaction_amount || 0,
          last_activity_at: data.last_activity_at || null,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotificationSettings = async () => {
    try {
      if (!user?.uid) return;

      const settingsRef = doc(db, 'user_notification_settings', user.uid);
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        setNotificationSettings({
          notifications_enabled: data.notifications_enabled ?? true,
          new_orders_notifications: data.new_orders_notifications ?? true,
          status_updates_notifications: data.status_updates_notifications ?? true,
          bid_notifications: data.bid_notifications ?? true,
          message_notifications: data.message_notifications ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    }
  };

  const updateNotificationSetting = async (setting: string, value: boolean) => {
    try {
      if (!user?.uid) return;

      const settingsRef = doc(db, 'user_notification_settings', user.uid);
      await setDoc(
        settingsRef,
        {
          user_id: user.uid,
          [setting]: value,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );

      setNotificationSettings(prev => ({
        ...prev,
        [setting]: value,
      }));
    } catch (error) {
      console.error('Error updating notification setting:', error);
      Alert.alert(t('error'), 'Failed to update notification settings');
    }
  };

  const pickAndUploadImage = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('error'), 'We need access to your photos');
      return;
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    setUploading(true);

    try {
      const photo = result.assets[0];

      // Convert to blob with timeout
      const response = await fetchWithTimeout(
        photo.uri,
        {
          method: 'GET',
        },
        15000
      ); // 15 second timeout for image download
      const blob = await response.blob();

      const fileExt = photo.uri.split('.').pop();
      const fileName = `avatars/${user?.uid}_${Date.now()}.${fileExt}`;

      // Upload to Firebase Storage
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, blob, {
        contentType: photo.mimeType || 'image/jpeg',
      });

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update profile in Firestore
      await updateDoc(doc(db, 'users', user?.uid!), {
        avatar_url: downloadURL,
        updated_at: new Date().toISOString(),
      });

      // Update local state
      setAvatarUrl(downloadURL);
      setProfile(profile ? { ...profile, avatar_url: downloadURL } : null);
      Alert.alert(t('success'), 'Profile picture updated');
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert(t('error'), 'Could not upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(t('signOut'), t('confirmSignOut'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            // Force navigation to login screen
            router.replace('/(auth)/login');
          } catch (error: any) {
            console.error('Logout error:', error);
            // Even if there's an error, navigate to login
            router.replace('/(auth)/login');
          }
        },
      },
    ]);
  };

  const handleLanguageChange = () => {
    Alert.alert(t('selectLanguage'), '', [
      {
        text: `🇳🇴 ${t('norwegian')}`,
        onPress: () => changeLanguage('no'),
      },
      {
        text: `🇺🇸 ${t('english')}`,
        onPress: () => changeLanguage('en'),
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header - Compact */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.profileHeaderRow}>
            <View style={styles.avatarContainer}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons
                    name={profile?.user_type === 'business' ? 'business' : 'person'}
                    size={40}
                    color={theme.iconColors.primary}
                  />
                </View>
              )}
              <TouchableOpacity
                style={styles.editAvatarButton}
                onPress={pickAndUploadImage}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={theme.iconColors.white} />
                ) : (
                  <Ionicons name="camera" size={14} color={theme.iconColors.white} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{profile?.full_name}</Text>
              <Text style={styles.userType}>
                {profile?.user_type === 'business' ? t('business') : t('private')}
              </Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={14} color={theme.iconColors.rating} />
                <Text style={styles.rating}>{profile?.rating}</Text>
                <Text style={styles.reviewsCount}>
                  ({profile?.total_reviews || 0} {t('reviews')})
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats - Hide if all zero */}
        {(statistics.orders_as_customer > 0 ||
          statistics.orders_as_carrier > 0 ||
          statistics.total_transaction_amount > 0) && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Ionicons name="person-outline" size={20} color={theme.iconColors.primary} />
              <Text style={styles.statNumber}>{statistics.orders_as_customer}</Text>
              <Text style={styles.statLabel}>{t('ordersAsCustomer')}</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="car-outline" size={20} color={theme.iconColors.success} />
              <Text style={styles.statNumber}>{statistics.orders_as_carrier}</Text>
              <Text style={styles.statLabel}>{t('ordersAsCarrier')}</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="wallet-outline" size={20} color={theme.iconColors.info} />
              <Text style={styles.statNumber}>
                {Math.round(statistics.total_transaction_amount)} NOK
              </Text>
              <Text style={styles.statLabel}>{t('totalTransactions')}</Text>
            </View>
          </View>
        )}

        {/* Activity Status */}
        {statistics.last_activity_at && (
          <View style={styles.activityContainer}>
            <View style={styles.activityCard}>
              <Ionicons name="time-outline" size={20} color={theme.iconColors.gray.primary} />
              <View style={styles.activityInfo}>
                <Text style={styles.activityLabel}>{t('lastActivity')}</Text>
                <Text style={styles.activityDate}>
                  {new Date(statistics.last_activity_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        )}
        {/* Push Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('pushNotifications')}</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color={theme.iconColors.gray.primary}
              />
              <View style={styles.settingInfo}>
                <Text style={styles.settingText}>{t('allNotifications')}</Text>
                <Text style={styles.settingDescription}>{t('enableAllNotifications')}</Text>
              </View>
            </View>
            <Switch
              value={notificationSettings.notifications_enabled}
              onValueChange={value => updateNotificationSetting('notifications_enabled', value)}
              trackColor={{ false: '#E5E7EB', true: '#FF7043' }}
              thumbColor={notificationSettings.notifications_enabled ? 'white' : '#F3F4F6'}
            />
          </View>
          <View
            style={[
              styles.settingRow,
              !notificationSettings.notifications_enabled && styles.disabledSetting,
            ]}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="cube-outline"
                size={20}
                color={!notificationSettings.notifications_enabled ? '#9CA3AF' : '#616161'}
              />
              <View style={styles.settingInfo}>
                <Text
                  style={[
                    styles.settingText,
                    !notificationSettings.notifications_enabled && styles.disabledText,
                  ]}
                >
                  {t('newOrdersNotifications')}
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    !notificationSettings.notifications_enabled && styles.disabledText,
                  ]}
                >
                  {t('notifyNewOrders')}
                </Text>
              </View>
            </View>
            <Switch
              value={notificationSettings.new_orders_notifications}
              onValueChange={value => updateNotificationSetting('new_orders_notifications', value)}
              disabled={!notificationSettings.notifications_enabled}
              trackColor={{ false: '#E5E7EB', true: '#FF7043' }}
              thumbColor={notificationSettings.new_orders_notifications ? 'white' : '#F3F4F6'}
            />
          </View>

          <View
            style={[
              styles.settingRow,
              !notificationSettings.notifications_enabled && styles.disabledSetting,
            ]}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={!notificationSettings.notifications_enabled ? '#9CA3AF' : '#616161'}
              />
              <View style={styles.settingInfo}>
                <Text
                  style={[
                    styles.settingText,
                    !notificationSettings.notifications_enabled && styles.disabledText,
                  ]}
                >
                  {t('statusUpdatesNotifications')}
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    !notificationSettings.notifications_enabled && styles.disabledText,
                  ]}
                >
                  {t('notifyStatusUpdates')}
                </Text>
              </View>
            </View>
            <Switch
              value={notificationSettings.status_updates_notifications}
              onValueChange={value =>
                updateNotificationSetting('status_updates_notifications', value)
              }
              disabled={!notificationSettings.notifications_enabled}
              trackColor={{ false: '#E5E7EB', true: '#FF7043' }}
              thumbColor={notificationSettings.status_updates_notifications ? 'white' : '#F3F4F6'}
            />
          </View>

          <View
            style={[
              styles.settingRow,
              !notificationSettings.notifications_enabled && styles.disabledSetting,
            ]}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="pricetag-outline"
                size={20}
                color={!notificationSettings.notifications_enabled ? '#9CA3AF' : '#616161'}
              />
              <View style={styles.settingInfo}>
                <Text
                  style={[
                    styles.settingText,
                    !notificationSettings.notifications_enabled && styles.disabledText,
                  ]}
                >
                  {t('bidNotifications')}
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    !notificationSettings.notifications_enabled && styles.disabledText,
                  ]}
                >
                  {t('notifyNewBids')}
                </Text>
              </View>
            </View>
            <Switch
              value={notificationSettings.bid_notifications}
              onValueChange={value => updateNotificationSetting('bid_notifications', value)}
              disabled={!notificationSettings.notifications_enabled}
              trackColor={{ false: '#E5E7EB', true: '#FF7043' }}
              thumbColor={notificationSettings.bid_notifications ? 'white' : '#F3F4F6'}
            />
          </View>

          <View
            style={[
              styles.settingRow,
              !notificationSettings.notifications_enabled && styles.disabledSetting,
            ]}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name="chatbubble-outline"
                size={20}
                color={!notificationSettings.notifications_enabled ? '#9CA3AF' : '#616161'}
              />
              <View style={styles.settingInfo}>
                <Text
                  style={[
                    styles.settingText,
                    !notificationSettings.notifications_enabled && styles.disabledText,
                  ]}
                >
                  {t('messageNotifications')}
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    !notificationSettings.notifications_enabled && styles.disabledText,
                  ]}
                >
                  {t('notifyNewMessages')}
                </Text>
              </View>
            </View>
            <Switch
              value={notificationSettings.message_notifications}
              onValueChange={value => updateNotificationSetting('message_notifications', value)}
              disabled={!notificationSettings.notifications_enabled}
              trackColor={{ false: '#E5E7EB', true: '#FF7043' }}
              thumbColor={notificationSettings.message_notifications ? 'white' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('contactInformation')}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={theme.iconColors.gray.primary} />
            <Text style={styles.infoText}>
              {profile?.show_email_publicly ? profile?.email : 'Hidden for privacy'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={theme.iconColors.gray.primary} />
            <Text style={styles.infoText}>
              {profile?.show_phone_publicly ? profile?.phone : 'Hidden for privacy'}
            </Text>
          </View>
          {profile?.city && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={theme.iconColors.gray.primary} />
              <Text style={styles.infoText}>
                {profile.city}
                {profile.region ? `, ${profile.region}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings')}</Text>

          <TouchableOpacity style={styles.settingRow} onPress={handleLanguageChange}>
            <View style={styles.settingLeft}>
              <Ionicons name="language-outline" size={20} color={theme.iconColors.gray.primary} />
              <Text style={styles.settingText}>{t('language')}</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {currentLanguage === 'no' ? t('norwegian') : t('english')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.iconColors.gray.primary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Business Info */}
        {profile?.user_type === 'business' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('businessInformation')}</Text>
            {profile.company_name && (
              <View style={styles.infoRow}>
                <Ionicons name="business-outline" size={20} color={theme.iconColors.gray.primary} />
                <Text style={styles.infoText}>{profile.company_name}</Text>
              </View>
            )}
            {profile.org_number && (
              <View style={styles.infoRow}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={theme.iconColors.gray.primary}
                />
                <Text style={styles.infoText}>{profile.org_number}</Text>
              </View>
            )}
          </View>
        )}

        {/* Bio */}
        {profile?.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Vehicle Information */}
        {profile?.user_type === 'business' && profile?.vehicle_type && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            <View style={styles.vehicleInfo}>
              <View style={styles.vehicleHeader}>
                <Ionicons name="car-outline" size={24} color={theme.iconColors.primary} />
                <Text style={styles.vehicleType}>
                  {profile.vehicle_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
                {profile.verified_carrier && (
                  <View style={styles.vehicleVerifiedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={theme.iconColors.success} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
              {profile.vehicle_capacity && (
                <Text style={styles.vehicleCapacity}>Capacity: {profile.vehicle_capacity} kg</Text>
              )}
              {profile.vehicle_description && (
                <Text style={styles.vehicleDescription}>{profile.vehicle_description}</Text>
              )}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/profile/edit' as any)}
          >
            <Ionicons name="create-outline" size={20} color={theme.iconColors.primary} />
            <Text style={styles.editButtonText}>{t('editProfile')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.securityButton}
            onPress={() => router.push('/profile/security' as any)}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.iconColors.success} />
            <Text style={styles.securityButtonText}>Security Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color={theme.iconColors.error} />
            <Text style={styles.signOutButtonText}>{t('signOut')}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('memberSince')} {new Date(profile?.created_at || '').getFullYear()}
          </Text>
          <Text style={styles.footerText}>TruckinFox v1.0.0</Text>
          {/* Bottom spacing for tab bar */}
          <View style={{ height: insets.bottom + 80 }} />
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
  },
  header: {
    backgroundColor: colors.white,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  userType: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    textTransform: 'capitalize',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginLeft: 4,
  },
  reviewsCount: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  statNumber: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginTop: 6,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: spacing.md,
  },
  activityContainer: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  activityCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  activityInfo: {
    marginLeft: spacing.md,
  },
  activityLabel: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  activityDate: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: 2,
  },
  section: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  infoText: {
    fontSize: fontSize.lg,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
  bioText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    lineHeight: spacing.xl,
  },
  vehicleInfo: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  vehicleType: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  vehicleVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  verifiedText: {
    fontSize: fontSize.sm,
    color: colors.status.success,
    fontWeight: fontWeight.semibold,
    marginLeft: spacing.xs,
  },
  vehicleCapacity: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  vehicleDescription: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  settingText: {
    fontSize: fontSize.lg,
    color: colors.text.primary,
  },
  settingDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
    lineHeight: spacing.lg,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  disabledSetting: {
    opacity: 0.5,
  },
  disabledText: {
    color: colors.text.tertiary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  editButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  securityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.status.success,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  securityButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.status.success,
    marginLeft: spacing.sm,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.status.error,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
  },
  signOutButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.status.error,
    marginLeft: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
});
