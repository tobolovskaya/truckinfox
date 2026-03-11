import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';
import Avatar from '../Avatar';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HomeHeaderProps {
  avatarUrl?: string;
  displayName: string;
  unreadCount: number;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({ avatarUrl, displayName, unreadCount }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const firstName = displayName?.split(' ')[0] || displayName;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
      {/* Left: Avatar + Greeting */}
      <TouchableOpacity
        style={styles.userRow}
        onPress={() => router.push('/(tabs)/profile')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('profile')}
      >
        <Avatar
          photoURL={avatarUrl}
          size={44}
          iconName="person"
          backgroundColor={colors.primaryLight}
          iconColor={colors.primary}
        />
        <View style={styles.greetingWrap}>
          <Text style={styles.greetingSmall}>{t('hello') ?? 'Hei'} 👋</Text>
          <Text style={styles.greetingName} numberOfLines={1}>{firstName}!</Text>
        </View>
      </TouchableOpacity>

      {/* Right: Map + Notifications */}
      <View style={styles.actions}>
        {/* Map button */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/(tabs)/map')}
          accessibilityRole="button"
          accessibilityLabel={t('map') ?? 'Kart'}
        >
          <Ionicons name="map-outline" size={22} color={colors.text.primary} />
        </TouchableOpacity>

        {/* Notifications button */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={t('notifications')}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text.primary} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  greetingWrap: {
    flex: 1,
  },
  greetingSmall: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  greetingName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: colors.white,
    includeFontPadding: false,
  },
});
