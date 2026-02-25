import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';
import { ScreenHeader } from '../../components/ScreenHeader';
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

const mergeAndSortOrders = (customerOrders: Order[], carrierOrders: Order[]): Order[] => {
  const uniqueOrders = new Map<string, Order>();

  [...customerOrders, ...carrierOrders].forEach(order => {
    uniqueOrders.set(order.id, order);
  });

  return Array.from(uniqueOrders.values()).sort(
    (a, b) => toSafeDate(b.created_at).getTime() - toSafeDate(a.created_at).getTime()
  );
};

const formatOrderDate = (value: Order['created_at']): string => {
  return toSafeDate(value).toLocaleDateString('no-NO');
};

export default function OrdersScreen() {
  const router = useRouter();
  const { unreadCount } = useUnreadCount();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const indexWarningShownRef = useRef(false);

  useEffect(() => {
    if (user?.uid) {
      fetchOrders();
    }
  }, [user?.uid]);

  const isIndexUnavailableError = (error: unknown): boolean => {
    const errorMessage = error instanceof Error ? error.message : String(error ?? '');
    return errorMessage.includes('requires an index') || errorMessage.includes('index is currently building');
  };

  const fetchOrders = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      // Fetch orders where user is customer OR carrier
      const customerOrdersQuery = query(
        collection(db, 'orders'),
        where('customer_id', '==', user.uid),
        orderBy('created_at', 'desc')
      );

      const carrierOrdersQuery = query(
        collection(db, 'orders'),
        where('carrier_id', '==', user.uid),
        orderBy('created_at', 'desc')
      );

      const [customerSnap, carrierSnap] = await Promise.all([
        getDocs(customerOrdersQuery),
        getDocs(carrierOrdersQuery),
      ]);

      const customerOrders = customerSnap.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Order, 'id'>),
      }));

      const carrierOrders = carrierSnap.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Order, 'id'>),
      }));

      const allOrders = mergeAndSortOrders(customerOrders, carrierOrders);

      setOrders(allOrders);
    } catch (error: unknown) {
      if (isIndexUnavailableError(error)) {
        // Fallback: query without orderBy and sort locally
        if (!indexWarningShownRef.current) {
          console.warn('⏳ Orders index is being created. Using local fallback sorting...');
          indexWarningShownRef.current = true;
        }
        
        try {
          const customerOrdersQuery = query(
            collection(db, 'orders'),
            where('customer_id', '==', user.uid)
          );

          const carrierOrdersQuery = query(
            collection(db, 'orders'),
            where('carrier_id', '==', user.uid)
          );

          const [customerSnap, carrierSnap] = await Promise.all([
            getDocs(customerOrdersQuery),
            getDocs(carrierOrdersQuery),
          ]);

          const customerOrders = customerSnap.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<Order, 'id'>),
          }));

          const carrierOrders = carrierSnap.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<Order, 'id'>),
          }));

          const allOrders = mergeAndSortOrders(customerOrders, carrierOrders);

          setOrders(allOrders);
        } catch (fallbackError) {
          console.error('Error fetching orders (fallback):', fallbackError);
        }
      } else {
        console.error('Error fetching orders:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchOrders();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const map: { [key: string]: string } = {
      active: 'onGoing',
      delivered: 'completed',
      cancelled: 'cancelled',
    };
    return t(map[status] || status);
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
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => router.push(`/order-status/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Order ${item.id}`}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderTitle} numberOfLines={1}>
          {item.cargo_title || t('order')} (#{item.id.slice(0, 8)})
        </Text>
        <View
          style={[styles.statusBadge, { backgroundColor: getPaymentStatusColor(item.payment_status) }]}
        >
          <Text style={styles.statusBadgeText}>{t(item.payment_status)}</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.label}>{t('amount')}:</Text>
          <Text style={styles.value}>{item.total_amount} NOK</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>{t('status')}:</Text>
          <Text style={styles.value}>{getStatusLabel(item.status)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>{t('date')}:</Text>
          <Text style={styles.value}>{formatOrderDate(item.created_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
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
        <View style={styles.emptyState}>
          <Ionicons name="list-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>{t('noOrdersFound')}</Text>
          <Text style={styles.emptyText}>{t('createRequestToSeeOrders')}</Text>

          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/(tabs)/create')}
              accessibilityRole="button"
              accessibilityLabel={t('createCargoRequest')}
            >
              <Text style={styles.primaryButtonText}>{t('createCargoRequest')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/(tabs)/home')}
              accessibilityRole="button"
              accessibilityLabel={t('allRequests')}
            >
              <Text style={styles.secondaryButtonText}>{t('allRequests')}</Text>
            </TouchableOpacity>
          </View>
        </View>
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

const styles = StyleSheet.create({
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
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  ctaRow: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  secondaryButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
