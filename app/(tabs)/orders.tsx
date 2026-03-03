import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { spacing, fontSize, fontWeight, useAppThemeStyles } from '../../lib/sharedStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EmptyState } from '../../components/EmptyState';
import EmptyCargoIllustration from '../../assets/empty-cargo.svg';
import { useUnreadCount } from '../../hooks/useNotifications';

interface Order {
  id: string;
  request_id?: string;
  bid_id?: string;
  customer_id: string;
  carrier_id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at?:
  | string
  | number
  | Date
  | {
    seconds?: number;
    nanoseconds?: number;
    toDate?: () => Date;
  }
  | null;
  cargo_title?: string;
  cargo_type?: string;
  cargo_from_address?: string;
  cargo_to_address?: string;
}

const toSafeDate = (value: Order['created_at']): Date => {
  if (!value) {
    return new Date(0);
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      const parsed = value.toDate();
      return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
    }

    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000);
    }
  }

  return new Date(0);
};

const formatOrderDate = (value: Order['created_at'], locale: string): string => {
  return toSafeDate(value).toLocaleDateString(locale);
};

export default function OrdersScreen() {
  const router = useRouter();
  const { colors } = useAppThemeStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { unreadCount } = useUnreadCount();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const locale = i18n.language.startsWith('no') ? 'nb-NO' : 'en-US';

  const formatNokAmount = useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'NOK',
        maximumFractionDigits: 0,
      }).format(Number(value || 0)),
    [locale]
  );

  const fetchOrders = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(
          'id, request_id, bid_id, customer_id, carrier_id, total_amount, status, payment_status, created_at'
        )
        .or(`customer_id.eq.${user.uid},carrier_id.eq.${user.uid}`)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const ordersData = ((data || []) as Order[]).map(item => ({
        ...item,
        cargo_title: item.cargo_title || '',
      }));

      const requestIds = Array.from(
        new Set(
          ordersData.map(item => item.request_id).filter((value): value is string => Boolean(value))
        )
      );

      if (requestIds.length > 0) {
        const { data: requestsData, error: requestsError } = await supabase
          .from('cargo_requests')
          .select('id, title, from_address, to_address')
          .in('id', requestIds);

        if (!requestsError && requestsData) {
          const requestMap = new Map(
            requestsData.map(requestItem => [
              requestItem.id,
              {
                title: requestItem.title || '',
                from_address: requestItem.from_address || '',
                to_address: requestItem.to_address || '',
              },
            ])
          );

          for (const orderItem of ordersData) {
            if (!orderItem.request_id) {
              continue;
            }
            const request = requestMap.get(orderItem.request_id);
            if (!request) {
              continue;
            }
            orderItem.cargo_title = orderItem.cargo_title || request.title;
            orderItem.cargo_from_address = request.from_address;
            orderItem.cargo_to_address = request.to_address;
          }
        }
      }

      const visibleOrders = ordersData.filter(orderItem => {
        const isOrphan = !orderItem.request_id;
        const paymentStatus = String(orderItem.payment_status || '')
          .trim()
          .toLowerCase();
        const isUnpaid = ['pending', 'initiated', 'failed'].includes(paymentStatus);
        return !(isOrphan && isUnpaid);
      });

      setOrders(visibleOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      fetchOrders();
    }
  }, [fetchOrders, user?.uid]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchOrders();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const normalizedStatus = String(status || '')
      .trim()
      .toLowerCase();
    const map: { [key: string]: string } = {
      active: 'active',
      delivered: 'completed',
      completed: 'completed',
      cancelled: 'cancelled',
      canceled: 'cancelled',
      in_progress: 'in_progress',
      in_transit: 'in_transit',
    };
    return t(map[normalizedStatus] || normalizedStatus);
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return colors.success || '#10B981';
      case 'pending':
        return colors.status.warning || '#F59E0B';
      default:
        return colors.text.secondary;
    }
  };

  const renderOrderItem = ({ item }: { item: Order }) => (
    <View style={styles.cardContainer}>
      <TouchableOpacity
        style={styles.orderCardInner}
        onPress={() => router.push(`/order-status/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Order ${item.id}`}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#ffffff', '#fcfcfc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.orderCardContent}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderTitle} numberOfLines={1}>
              {item.cargo_title || t('order')} (#{item.id.slice(0, 8)})
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getPaymentStatusColor(item.payment_status) },
              ]}
            >
              <Text style={styles.statusBadgeText}>{t(item.payment_status)}</Text>
            </View>
          </View>

          {!item.cargo_title && (item.cargo_from_address || item.cargo_to_address) && (
            <Text style={styles.orderSubtitle} numberOfLines={1}>
              {item.cargo_from_address || t('addressNotAvailable')} →{' '}
              {item.cargo_to_address || t('addressNotAvailable')}
            </Text>
          )}

          <View style={styles.orderDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.label}>{t('amount')}:</Text>
              <Text style={styles.value}>{formatNokAmount(item.total_amount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>{t('status')}:</Text>
              <Text style={styles.value}>{getStatusLabel(item.status)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>{t('date')}:</Text>
              <Text style={styles.value}>{formatOrderDate(item.created_at, locale)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('orders') || 'Ordrer'}
        showBackButton={false}
        showBrandMark={true}
        brandMarkMaxTitleLength={18}
        rightAction={{
          icon: 'notifications-outline',
          onPress: () => router.push('/(tabs)/notifications'),
          label: t('notifications'),
          badge: unreadCount,
        }}
      />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title={t('noOrdersFound') || 'No orders yet'}
          description={t('createRequestToSeeOrders') || 'Create a request to start getting orders'}
          illustration={EmptyCargoIllustration}
          actions={[
            {
              label: t('createRequest') || t('createCargoRequest') || 'Create request',
              icon: 'add-outline',
              variant: 'primary',
              onPress: () => router.push('/(tabs)/create'),
            },
          ]}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          scrollEnabled={true}
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContainer: {
      padding: spacing.md,
      gap: spacing.md,
    },
    cardContainer: {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    orderCardInner: {
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(230,230,230,0.5)',
    },
    orderCardContent: {
      padding: spacing.md,
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    orderTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
      flex: 1,
    },
    orderSubtitle: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      marginBottom: spacing.xs,
    },
    statusBadge: {
      borderRadius: 6,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      marginLeft: spacing.sm,
    },
    statusBadgeText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.white,
    },
    orderDetails: {
      gap: spacing.xs,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    label: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
    },
    value: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
  });
