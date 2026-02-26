import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppThemeStyles } from '../../lib/sharedStyles';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EmptyState } from '../../components/EmptyState';
import EmptyCargoIllustration from '../../assets/empty-cargo.svg';
import { useTranslation } from 'react-i18next';

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useAppThemeStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('notifications') || 'Notifications'} onBackPress={() => router.back()} />
      <EmptyState
        icon="notifications-outline"
        title={t('noNotifications') || 'No notifications'}
        description={
          t('allCaughtUp') ||
          "You're all caught up. Create a request or browse marketplace activity."
        }
        illustration={EmptyCargoIllustration}
        actions={[
          {
            label: t('createRequest') || 'Create request',
            icon: 'add-outline',
            variant: 'primary',
            onPress: () => router.push('/(tabs)/create'),
          },
          {
            label: t('browseMarketplace') || 'Browse marketplace',
            icon: 'search-outline',
            variant: 'secondary',
            onPress: () => router.push('/(tabs)/home'),
          },
        ]}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppThemeStyles>['colors']) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  });
