import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { db } from '../../lib/firebase';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';

type NotificationSettings = {
  push_notifications_enabled: boolean;
  new_orders_notifications: boolean;
  status_updates_notifications: boolean;
  bid_notifications: boolean;
  message_notifications: boolean;
};

type PrivacySettings = {
  show_phone_publicly: boolean;
  show_email_publicly: boolean;
  allow_location_tracking: boolean;
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage } = useI18n();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    push_notifications_enabled: true,
    new_orders_notifications: true,
    status_updates_notifications: true,
    bid_notifications: true,
    message_notifications: true,
  });
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    show_phone_publicly: false,
    show_email_publicly: false,
    allow_location_tracking: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, 'users', user.uid));
        const data = snapshot.exists() ? snapshot.data() : null;

        if (data?.notification_settings) {
          setNotificationSettings(prev => ({
            ...prev,
            ...data.notification_settings,
          }));
        }

        if (data?.privacy_settings) {
          setPrivacySettings(prev => ({
            ...prev,
            ...data.privacy_settings,
          }));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        Alert.alert(t('error'), t('somethingWentWrong'));
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [t, user?.uid]);

  const handleLanguageChange = async (language: 'no' | 'en') => {
    try {
      await changeLanguage(language);
    } catch (error) {
      console.error('Failed to change language:', error);
      Alert.alert(t('error'), t('somethingWentWrong'));
    }
  };

  const updateSettings = async (
    notifSettings?: NotificationSettings,
    privacySettingsUpdate?: PrivacySettings
  ) => {
    if (!user?.uid) return;

    try {
      setSaving(true);
      const updates: any = {};

      if (notifSettings) {
        updates.notification_settings = notifSettings;
      }
      if (privacySettingsUpdate) {
        updates.privacy_settings = privacySettingsUpdate;
      }
      updates.updated_at = new Date().toISOString();

      await updateDoc(doc(db, 'users', user.uid), updates);
    } catch (error) {
      console.error('Failed to update settings:', error);
      Alert.alert(t('error'), t('somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationToggle = (key: keyof NotificationSettings) => {
    const updated = { ...notificationSettings, [key]: !notificationSettings[key] };
    setNotificationSettings(updated);
    updateSettings(updated);
  };

  const handlePrivacyToggle = (key: keyof PrivacySettings) => {
    const updated = { ...privacySettings, [key]: !privacySettings[key] };
    setPrivacySettings(updated);
    updateSettings(undefined, updated);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t('settings')} showBackButton={true} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settings')} showBackButton={true} />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Language & Region Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('languageRegion')}</Text>

          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="globe-outline" size={24} color={colors.primary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>{t('language')}</Text>
                  <Text style={styles.settingValue}>{currentLanguage === 'no' ? t('norwegian') : t('english')}</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.languageButtons}>
              <TouchableOpacity
                style={[styles.languageButton, currentLanguage === 'no' && styles.languageButtonActive]}
                onPress={() => handleLanguageChange('no')}
              >
                <Text style={[styles.languageButtonText, currentLanguage === 'no' && styles.languageButtonTextActive]}>
                  {t('norwegian')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.languageButton, currentLanguage === 'en' && styles.languageButtonActive]}
                onPress={() => handleLanguageChange('en')}
              >
                <Text style={[styles.languageButtonText, currentLanguage === 'en' && styles.languageButtonTextActive]}>
                  {t('english')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Push Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('pushNotifications')}</Text>

          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="notifications-outline" size={24} color={colors.primary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>{t('allNotifications')}</Text>
                  <Text style={styles.settingValue}>{t('enableAllNotifications')}</Text>
                </View>
              </View>
              <Switch
                value={notificationSettings.push_notifications_enabled}
                onValueChange={() => handleNotificationToggle('push_notifications_enabled')}
                trackColor={{ false: colors.divider, true: `${colors.primary}40` }}
                thumbColor={notificationSettings.push_notifications_enabled ? colors.primary : colors.text.tertiary}
              />
            </View>

            {notificationSettings.push_notifications_enabled && (
              <>
                <View style={styles.divider} />

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="package-outline" size={20} color={colors.text.secondary} />
                    <Text style={styles.settingLabel}>{t('newOrdersNotifications')}</Text>
                  </View>
                  <Switch
                    value={notificationSettings.new_orders_notifications}
                    onValueChange={() => handleNotificationToggle('new_orders_notifications')}
                    trackColor={{ false: colors.divider, true: `${colors.primary}40` }}
                    thumbColor={notificationSettings.new_orders_notifications ? colors.primary : colors.text.tertiary}
                  />
                </View>

                <View style={styles.smallDivider} />

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={colors.text.secondary} />
                    <Text style={styles.settingLabel}>{t('statusUpdatesNotifications')}</Text>
                  </View>
                  <Switch
                    value={notificationSettings.status_updates_notifications}
                    onValueChange={() => handleNotificationToggle('status_updates_notifications')}
                    trackColor={{ false: colors.divider, true: `${colors.primary}40` }}
                    thumbColor={notificationSettings.status_updates_notifications ? colors.primary : colors.text.tertiary}
                  />
                </View>

                <View style={styles.smallDivider} />

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="trending-up-outline" size={20} color={colors.text.secondary} />
                    <Text style={styles.settingLabel}>{t('bidNotifications')}</Text>
                  </View>
                  <Switch
                    value={notificationSettings.bid_notifications}
                    onValueChange={() => handleNotificationToggle('bid_notifications')}
                    trackColor={{ false: colors.divider, true: `${colors.primary}40` }}
                    thumbColor={notificationSettings.bid_notifications ? colors.primary : colors.text.tertiary}
                  />
                </View>

                <View style={styles.smallDivider} />

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="chatbubble-outline" size={20} color={colors.text.secondary} />
                    <Text style={styles.settingLabel}>{t('messageNotifications')}</Text>
                  </View>
                  <Switch
                    value={notificationSettings.message_notifications}
                    onValueChange={() => handleNotificationToggle('message_notifications')}
                    trackColor={{ false: colors.divider, true: `${colors.primary}40` }}
                    thumbColor={notificationSettings.message_notifications ? colors.primary : colors.text.tertiary}
                  />
                </View>
              </>
            )}
          </View>
        </View>

        {/* Privacy Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('privacySettings')}</Text>

          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="call-outline" size={24} color={colors.primary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>{t('showPhonePublicly')}</Text>
                </View>
              </View>
              <Switch
                value={privacySettings.show_phone_publicly}
                onValueChange={() => handlePrivacyToggle('show_phone_publicly')}
                trackColor={{ false: colors.divider, true: `${colors.primary}40` }}
                thumbColor={privacySettings.show_phone_publicly ? colors.primary : colors.text.tertiary}
              />
            </View>

            <View style={styles.smallDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="mail-outline" size={24} color={colors.primary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>{t('showEmailPublicly')}</Text>
                </View>
              </View>
              <Switch
                value={privacySettings.show_email_publicly}
                onValueChange={() => handlePrivacyToggle('show_email_publicly')}
                trackColor={{ false: colors.divider, true: `${colors.primary}40` }}
                thumbColor={privacySettings.show_email_publicly ? colors.primary : colors.text.tertiary}
              />
            </View>

            <View style={styles.smallDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="location-outline" size={24} color={colors.primary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>{t('allowLocationTracking')}</Text>
                </View>
              </View>
              <Switch
                value={privacySettings.allow_location_tracking}
                onValueChange={() => handlePrivacyToggle('allow_location_tracking')}
                trackColor={{ false: colors.divider, true: `${colors.primary}40` }}
                thumbColor={privacySettings.allow_location_tracking ? colors.primary : colors.text.tertiary}
              />
            </View>
          </View>
        </View>

        {/* Other Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('otherSettings')}</Text>

          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert(t('info') || 'Info', 'Version 1.0.0')}>
              <View style={styles.settingInfo}>
                <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingLabel}>{t('version')}</Text>
                  <Text style={styles.settingValue}>1.0.0</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {saving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.savingText}>{t('saving') || 'Saving...'}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginLeft: spacing.sm,
  },
  settingsCard: {
    backgroundColor: colors.white,
    borderRadius: spacing.md,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  settingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginRight: spacing.md,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  settingValue: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  smallDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: spacing.md + 24,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  languageButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
  },
  languageButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  languageButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  languageButtonTextActive: {
    color: colors.white,
  },
  savingIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  savingText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
});
