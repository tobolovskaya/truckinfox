import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';
import Avatar from '../Avatar';
import { useTranslation } from 'react-i18next';

interface HomeHeaderProps {
  avatarUrl?: string;
  displayName: string;
  unreadCount: number;
  insets: {
    top: number;
  };
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  avatarUrl,
  displayName,
  unreadCount,
  insets,
}) => {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.userInfoRow}>
        <Avatar
          photoURL={avatarUrl}
          size={44}
          iconName="person"
          backgroundColor={colors.primaryLight}
          iconColor={colors.primary}
        />
        <View style={styles.userTextWrap}>
          <Text style={styles.welcomeText}>Hei, {displayName}!</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.notificationButton}
        onPress={() => router.push('/notifications')}
        accessibilityRole="button"
        accessibilityLabel={t('notifications')}
        accessibilityHint={t('viewNotifications')}
      >
        <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
        {unreadCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  userTextWrap: {
    flex: 1,
  },
  welcomeText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  notificationButton: {
    position: 'relative',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
});
