import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';
import Avatar from '../Avatar';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../ScreenHeader';

interface HomeHeaderProps {
  avatarUrl?: string;
  displayName: string;
  unreadCount: number;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({ avatarUrl, displayName, unreadCount }) => {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <ScreenHeader
      title=""
      showBackButton={false}
      secondaryRightAction={{
        icon: 'map-outline',
        onPress: () => router.push('/(tabs)/map'),
        label: t('map'),
      }}
      rightAction={{
        icon: 'notifications-outline',
        onPress: () => router.push('/(tabs)/notifications'),
        label: t('notifications'),
        badge: unreadCount,
      }}
      customCenter={
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
      }
    />
  );
};

const styles = StyleSheet.create({
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  userTextWrap: {
    flex: 1,
  },
  welcomeText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    flexShrink: 1,
  },
});
