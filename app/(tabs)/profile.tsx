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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonLoader } from '../../components/SkeletonLoader';
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
    last_activity_at: null as string | null,
    active_bids: 0,
    completed_orders: 0,
    cancelled_orders: 0,
    success_rate: 0,
    avg_rating: 0,
    total_distance: 0,
  });
  const [enhancedStatsLoading, setEnhancedStatsLoading] = useState(false);
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
    fetchEnhancedStatistics();
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
          active_bids: 0,
          completed_orders: 0,
          cancelled_orders: 0,
          success_rate: 0,
          avg_rating: 0,
          total_distance: 0,
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
          active_bids: 0,
          completed_orders: 0,
          cancelled_orders: 0,
          success_rate: 0,
          avg_rating: data.rating || 0,
          total_distance: 0,
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

  const fetchEnhancedStatistics = async () => {
    try {
      if (!user?.uid) return;
      setEnhancedStatsLoading(true);

      // Fetch active bids (where user is carrier)
      const activeBidsQuery = query(
        collection(db, 'bids'),
        where('carrier_id', '==', user.uid),
        where('status', 'in', ['pending', 'submitted'])
      );
      const activeBidsSnap = await getDocs(activeBidsQuery);
      const activeBidsCount = activeBidsSnap.size;

      // Fetch completed orders
      const completedOrdersQuery = query(
        collection(db, 'orders'),
        where('status', '==', 'delivered')
      );
      const completedOrdersSnap = await getDocs(completedOrdersQuery);
      let userCompletedOrders = 0;
      completedOrdersSnap.forEach(doc => {
        const data = doc.data();
        if (data.customer_id === user.uid || data.carrier_id === user.uid) {
          userCompletedOrders++;
        }
      });

      // Fetch cancelled orders
      const cancelledOrdersQuery = query(
        collection(db, 'orders'),
        where('status', 'in', ['cancelled', 'failed'])
      );
      const cancelledOrdersSnap = await getDocs(cancelledOrdersQuery);
      let userCancelledOrders = 0;
      cancelledOrdersSnap.forEach(doc => {
        const data = doc.data();
        if (data.customer_id === user.uid || data.carrier_id === user.uid) {
          userCancelledOrders++;
        }
      });

      // Calculate success rate
      const totalOrders = userCompletedOrders + userCancelledOrders;
      const successRate = totalOrders > 0 ? (userCompletedOrders / totalOrders) * 100 : 0;

      // Update statistics
      setStatistics(prev => ({
        ...prev,
        active_bids: activeBidsCount,
        completed_orders: userCompletedOrders,
        cancelled_orders: userCancelledOrders,
        success_rate: Math.round(successRate),
        avg_rating: profile?.rating || 0,
      }));
    } catch (error) {
      console.error('Error fetching enhanced statistics:', error);
    } finally {
      setEnhancedStatsLoading(false);
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

  const updatePrivacySetting = async (setting: string, value: boolean) => {
    try {
      if (!user?.uid) return;

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        [setting]: value,
        updated_at: new Date().toISOString(),
      });

      setProfile(prev => (prev ? { ...prev, [setting]: value } : null));
    } catch (error) {
      console.error('Error updating privacy setting:', error);
      Alert.alert(t('error'), 'Failed to update privacy settings');
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

        {/* Enhanced Statistics Section */}
        <View style={styles.statisticsSection}>
          <View style={styles.statisticsHeader}>
            <Text style={styles.statisticsTitle}>{t('statistics')}</Text>
            {profile?.created_at && (
              <Text style={styles.memberSince}>
                {t('memberSince')}{' '}
                {new Date(profile.created_at).toLocaleDateString('no-NO', {
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            )}
          </View>

          {enhancedStatsLoading ? (
            <SkeletonLoader variant="stats" count={1} />
          ) : statistics.orders_as_customer === 0 &&
            statistics.orders_as_carrier === 0 &&
            statistics.total_transaction_amount === 0 ? (
            <View style={styles.noStatsContainer}>
              <Ionicons name="bar-chart-outline" size={48} color={theme.iconColors.gray.light} />
              <Text style={styles.noStatsTitle}>{t('noStatisticsYet')}</Text>
              <Text style={styles.noStatsDescription}>{t('startUsingApp')}</Text>
            </View>
          ) : (
            <>
              {/* Primary Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#FFF4F0' }]}>
                    <Ionicons name="cube-outline" size={20} color={theme.iconColors.primary} />
                  </View>
                  <Text style={styles.statNumber}>{statistics.orders_as_customer}</Text>
                  <Text style={styles.statLabel}>{t('ordersAsCustomer')}</Text>
                </View>

                <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="car-outline" size={20} color={theme.iconColors.success} />
                  </View>
                  <Text style={styles.statNumber}>{statistics.orders_as_carrier}</Text>
                  <Text style={styles.statLabel}>{t('ordersAsCarrier')}</Text>
                </View>

                <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="wallet-outline" size={20} color={theme.iconColors.info} />
                  </View>
                  <Text style={styles.statNumber}>
                    {Math.round(statistics.total_transaction_amount / 1000)}k
                  </Text>
                  <Text style={styles.statLabel}>NOK</Text>
                </View>

                <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons name="star-outline" size={20} color={theme.iconColors.rating} />
                  </View>
                  <Text style={styles.statNumber}>{statistics.avg_rating.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>{t('rating')}</Text>
                </View>
              </View>

              {/* Secondary Stats */}
              <View style={styles.secondaryStatsContainer}>
                {statistics.active_bids > 0 && (
                  <View style={styles.secondaryStatRow}>
                    <View style={styles.secondaryStatLeft}>
                      <Ionicons
                        name="pricetag-outline"
                        size={16}
                        color={theme.iconColors.gray.primary}
                      />
                      <Text style={styles.secondaryStatLabel}>{t('activeBids')}</Text>
                    </View>
                    <Text style={styles.secondaryStatValue}>{statistics.active_bids}</Text>
                  </View>
                )}

                {statistics.completed_orders > 0 && (
                  <View style={styles.secondaryStatRow}>
                    <View style={styles.secondaryStatLeft}>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={16}
                        color={theme.iconColors.success}
                      />
                      <Text style={styles.secondaryStatLabel}>{t('completedOrders')}</Text>
                    </View>
                    <Text style={styles.secondaryStatValue}>{statistics.completed_orders}</Text>
                  </View>
                )}

                {statistics.success_rate > 0 && (
                  <View style={styles.secondaryStatRow}>
                    <View style={styles.secondaryStatLeft}>
                      <Ionicons name="trophy-outline" size={16} color={theme.iconColors.rating} />
                      <Text style={styles.secondaryStatLabel}>{t('successRate')}</Text>
                    </View>
                    <Text style={styles.secondaryStatValue}>{statistics.success_rate}%</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>

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

          {/* Language & Region */}
          <Text style={styles.subSectionTitle}>{t('languageRegion')}</Text>
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

          {/* Privacy Settings */}
          <Text style={styles.subSectionTitle}>{t('privacySettings')}</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="eye-outline" size={20} color={theme.iconColors.gray.primary} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingText}>{t('showPhonePublicly')}</Text>
                <Text style={styles.settingDescription}>Allow others to see your phone number</Text>
              </View>
            </View>
            <Switch
              value={profile?.show_phone_publicly ?? false}
              onValueChange={value => updatePrivacySetting('show_phone_publicly', value)}
              trackColor={{ false: '#E5E7EB', true: '#FF7043' }}
              thumbColor={profile?.show_phone_publicly ? 'white' : '#F3F4F6'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="mail-outline" size={20} color={theme.iconColors.gray.primary} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingText}>{t('showEmailPublicly')}</Text>
                <Text style={styles.settingDescription}>Allow others to see your email</Text>
              </View>
            </View>
            <Switch
              value={profile?.show_email_publicly ?? false}
              onValueChange={value => updatePrivacySetting('show_email_publicly', value)}
              trackColor={{ false: '#E5E7EB', true: '#FF7043' }}
              thumbColor={profile?.show_email_publicly ? 'white' : '#F3F4F6'}
            />
          </View>

          {/* Help & Support */}
          <Text style={styles.subSectionTitle}>{t('helpSupport')}</Text>
          <TouchableOpacity style={styles.settingRow} onPress={() => {}}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={theme.iconColors.gray.primary}
              />
              <Text style={styles.settingText}>{t('about')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.iconColors.gray.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingRow} onPress={() => {}}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={theme.iconColors.gray.primary}
              />
              <Text style={styles.settingText}>{t('termsOfService')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.iconColors.gray.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingRow} onPress={() => {}}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={theme.iconColors.gray.primary}
              />
              <Text style={styles.settingText}>{t('privacyPolicy')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.iconColors.gray.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingRow} onPress={() => {}}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="chatbubbles-outline"
                size={20}
                color={theme.iconColors.gray.primary}
              />
              <Text style={styles.settingText}>{t('contactSupport')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.iconColors.gray.primary} />
          </TouchableOpacity>

          <View style={styles.versionRow}>
            <Text style={styles.versionText}>{t('version')} 1.0.0</Text>
          </View>
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
            style={styles.paymentHistoryButton}
            onPress={() => router.push('/profile/payments' as any)}
          >
            <Ionicons name="wallet-outline" size={20} color={theme.iconColors.info} />
            <Text style={styles.paymentHistoryButtonText}>{t('paymentHistory')}</Text>
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
    minWidth: '45%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
    marginBottom: spacing.sm,
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
  statisticsSection: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.sm,
  },
  statisticsHeader: {
    marginBottom: spacing.lg,
  },
  statisticsTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  memberSince: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  statsLoadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  noStatsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  noStatsTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  noStatsDescription: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.md,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  secondaryStatsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: spacing.md,
  },
  secondaryStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  secondaryStatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  secondaryStatLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  secondaryStatValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
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
  subSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  versionRow: {
    paddingTop: spacing.lg,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  versionText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
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
  paymentHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: theme.iconColors.info,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  paymentHistoryButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: theme.iconColors.info,
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
