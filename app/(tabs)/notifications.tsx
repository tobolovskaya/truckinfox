import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppThemeStyles, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EmptyState } from '../../components/EmptyState';
import EmptyNotificationsIllustration from '../../assets/empty-notifications.svg';
import { useNotifications } from '../../hooks/useNotifications';
import { type Notification } from '../../utils/notifications';

const NOTIFICATION_ICONS: Record<Notification['type'], keyof typeof Ionicons.glyphMap> = {
  new_bid: 'cash-outline',
  bid_accepted: 'checkmark-circle-outline',
  payment_success: 'card-outline',
  order_status_change: 'cube-outline',
};

function formatRelativeTime(timestamp: Notification['created_at']): string {
  const date =
    typeof timestamp === 'object' && 'toDate' in timestamp
      ? timestamp.toDate()
      : new Date(timestamp as string);

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useAppThemeStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();

  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh } =
    useNotifications(50);

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      if (!notification.read) {
        await markAsRead(notification.id);
      }
      if (notification.related_type === 'order' && notification.related_id) {
        router.push(`/order-status/${notification.related_id}` as never);
      } else if (notification.related_type === 'cargo_request' && notification.related_id) {
        router.push(`/request-details/${notification.related_id}` as never);
      }
    },
    [markAsRead, router]
  );

  const renderNotification = useCallback(
    ({ item }: { item: Notification }) => {
      const icon = (NOTIFICATION_ICONS[item.type] || 'notifications-outline') as keyof typeof Ionicons.glyphMap;
      return (
        <TouchableOpacity
          style={[styles.notificationItem, !item.read && styles.unreadItem]}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, !item.read && styles.unreadIconContainer]}>
            <Ionicons
              name={icon}
              size={22}
              color={item.read ? colors.text.secondary : colors.primary}
            />
          </View>
          <View style={styles.notificationContent}>
            <Text style={[styles.notificationTitle, !item.read && styles.unreadTitle]}>
              {item.title}
            </Text>
            <Text style={styles.notificationBody} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={styles.notificationTime}>{formatRelativeTime(item.created_at)}</Text>
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      );
    },
    [styles, colors, handleNotificationPress]
  );

  const ListHeader = useMemo(() => {
    if (unreadCount === 0) return null;
    return (
      <View style={styles.listHeader}>
        <Text style={styles.unreadCountText}>
          {unreadCount} {t('unread') || 'unread'}
        </Text>
        <TouchableOpacity onPress={markAllAsRead}>
          <Text style={styles.markAllRead}>{t('markAllAsRead') || 'Mark all as read'}</Text>
        </TouchableOpacity>
      </View>
    );
  }, [unreadCount, t, markAllAsRead, styles]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title={t('notifications') || 'Notifications'}
          onBackPress={() => router.back()}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('notifications') || 'Notifications'}
        onBackPress={() => router.back()}
      />
      {notifications.length === 0 ? (
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
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppThemeStyles>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      paddingBottom: spacing.xl,
    },
    listHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    unreadCountText: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    markAllRead: {
      fontSize: fontSize.sm,
      color: colors.primary,
      fontWeight: fontWeight.semibold,
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.white,
    },
    unreadItem: {
      backgroundColor: `${colors.primary}08`,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
      flexShrink: 0,
    },
    unreadIconContainer: {
      backgroundColor: `${colors.primary}15`,
    },
    notificationContent: {
      flex: 1,
      marginRight: spacing.sm,
    },
    notificationTitle: {
      fontSize: fontSize.md,
      color: colors.text.primary,
      fontWeight: '500',
      marginBottom: 3,
    },
    unreadTitle: {
      fontWeight: fontWeight.semibold,
    },
    notificationBody: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      lineHeight: 20,
      marginBottom: 4,
    },
    notificationTime: {
      fontSize: fontSize.xs,
      color: colors.text.tertiary,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 6,
      flexShrink: 0,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border.default,
      marginLeft: spacing.md + 44 + spacing.md,
    },
  });
