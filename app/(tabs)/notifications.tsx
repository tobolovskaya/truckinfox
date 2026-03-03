import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppThemeStyles } from '../../lib/sharedStyles';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EmptyState } from '../../components/EmptyState';
import EmptyNotificationsIllustration from '../../assets/empty-notifications.svg';
import { useTranslation } from 'react-i18next';

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useAppThemeStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('notifications') || 'Notifications'}
        onBackPress={() => router.back()}
      />
      <EmptyState
        icon="notifications-outline"
        title={t('noNotifications')}
        description={t('allCaughtUp')}
        illustration={EmptyNotificationsIllustration}
        actions={[
          {
            label: t('createRequest') || 'Create request',
            icon: 'add-outline',
            variant: 'primary',
            onPress: () => router.push('/(tabs)/create'),
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
