import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { spacing, fontSize, fontWeight, useAppThemeStyles } from '../../lib/sharedStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import EmptyOrdersIllustration from '../../assets/empty-orders.svg';

type TabKey = 'active' | 'completed' | 'cancelled';

const TAB_STATUSES: Record<TabKey, string[]> = {
  active: ['pending_payment', 'paid', 'active', 'in_progress', 'in_transit', 'delivered'],
  completed: ['completed'],
  cancelled: ['cancelled', 'canceled', 'refunded', 'disputed'],
};

interface Order {
  id: string;
  request_id?: string | null;
  bid_id?: string | null;
  customer_id: string;
  carrier_id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at?: string | null;
  cargo_title?: string;
  cargo_from_address?: string;
  cargo_to_address?: string;
}

const formatOrderDate = (value: string | null | undefined, locale: string): string => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale);
};

export default function OrdersScreen() {
  const router = useRouter();
  const { colors } = useAppThemeStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('active');

  const locale = i18n.language.startsWith('no') ? 'nb-NO' : 'en-US';

  const formatNokAmount = useCallback(
    (value: number) =>
      `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(value || 0))} kr`,
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
        .select('id, request_id, bid_id, customer_id, carrier_id, total_amount, status, payment_status, created_at')
        .or(`customer_id.eq.${user.uid},carrier_id.eq.${user.uid}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ordersData: Order[] = (data || []).map(item => ({ ...item, cargo_title: '' }));

      const requestIds = Array.from(
        new Set(ordersData.map(o => o.request_id).filter((v): v is string => Boolean(v)))
      );

      if (requestIds.length > 0) {
        const { data: requestsData } = await supabase
          .from('cargo_requests')
          .select('id, title, from_address, to_address')
          .in('id', requestIds);

        if (requestsData) {
          const requestMap = new Map(requestsData.map(r => [r.id, r]));
          for (const order of ordersData) {
            if (!order.request_id) continue;
            const req = requestMap.get(order.request_id);
            if (!req) continue;
            order.cargo_title = req.title || '';
            order.cargo_from_address = req.from_address || '';
            order.cargo_to_address = req.to_address || '';
          }
        }
      }

      // Hide orphan orders with unpaid status (provisional, never confirmed)
      setOrders(
        ordersData.filter(o => {
          if (!o.request_id) {
            const ps = String(o.payment_status || '').trim().toLowerCase();
            return !['pending', 'initiated', 'failed'].includes(ps);
          }
          return true;
        })
      );
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) fetchOrders();
  }, [fetchOrders, user?.uid]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await fetchOrders(); } finally { setRefreshing(false); }
  };

  const tabCounts = useMemo(
    () => ({
      active: orders.filter(o => TAB_STATUSES.active.includes(o.status.toLowerCase())).length,
      completed: orders.filter(o => TAB_STATUSES.completed.includes(o.status.toLowerCase())).length,
      cancelled: orders.filter(o => TAB_STATUSES.cancelled.includes(o.status.toLowerCase())).length,
    }),
    [orders]
  );

  const filteredOrders = useMemo(
    () => orders.filter(o => TAB_STATUSES[activeTab].includes(o.status.toLowerCase())),
    [orders, activeTab]
  );

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (['completed'].includes(s)) return colors.success || '#10B981';
    if (['cancelled', 'canceled', 'refunded', 'disputed'].includes(s)) return colors.status?.error || '#EF4444';
    if (['delivered'].includes(s)) return '#8B5CF6';
    if (['in_progress', 'in_transit'].includes(s)) return colors.primary || '#3B82F6';
    if (['paid'].includes(s)) return '#10B981';
    return colors.status?.warning || '#F59E0B';
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending_payment: 'pendingPayment',
      paid: 'paid',
      active: 'active',
      in_progress: 'in_progress',
      in_transit: 'in_transit',
      delivered: 'delivered',
      completed: 'completed',
      cancelled: 'cancelled',
      canceled: 'cancelled',
      refunded: 'refunded',
      disputed: 'disputed',
    };
    const key = map[status.toLowerCase()];
    return key ? t(key) : status;
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
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusBadgeText}>{getStatusLabel(item.status)}</Text>
            </View>
          </View>

          {(item.cargo_from_address || item.cargo_to_address) && (
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
              <Text style={styles.label}>{t('date')}:</Text>
              <Text style={styles.value}>{formatOrderDate(item.created_at, locale)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'active', label: t('active') },
    { key: 'completed', label: t('completed') },
    { key: 'cancelled', label: t('cancelled') },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('orders') || 'Ordrer'}
        showBackButton={false}
        showBrandMark={true}
        brandMarkMaxTitleLength={18}
      />

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tabCounts[tab.key] > 0 && (
              <View style={[styles.tabBadge, activeTab === tab.key && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === tab.key && styles.tabBadgeTextActive]}>
                  {tabCounts[tab.key]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}>
          <SkeletonLoader variant="card" count={3} />
        </View>
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title={t('noOrdersFound') || 'No orders yet'}
          description={
            activeTab === 'active'
              ? t('createRequestToSeeOrders') || 'Create a request to start getting orders'
              : t('noOrdersInTab') || 'No orders in this category'
          }
          illustration={activeTab === 'active' ? EmptyOrdersIllustration : undefined}
          actions={
            activeTab === 'active'
              ? [
                  {
                    label: t('createRequest') || 'Create request',
                    icon: 'add-outline',
                    variant: 'primary',
                    onPress: () => router.push('/(tabs)/create'),
                  },
                ]
              : undefined
          }
        />
      ) : (
        <FlashList
          data={filteredOrders}
          keyExtractor={item => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={handleRefresh}
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
    skeletonContainer: {
      flex: 1,
      padding: spacing.md,
    },
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: 0,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.06)',
      gap: spacing.xs,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      gap: 4,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.text.secondary,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: fontWeight.semibold,
    },
    tabBadge: {
      backgroundColor: 'rgba(0,0,0,0.08)',
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    tabBadgeActive: {
      backgroundColor: colors.primary,
    },
    tabBadgeText: {
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      color: colors.text.secondary,
    },
    tabBadgeTextActive: {
      color: '#fff',
    },
    listContainer: {
      padding: spacing.md,
    },
    cardContainer: {
      marginBottom: spacing.md,
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
      color: '#fff',
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
