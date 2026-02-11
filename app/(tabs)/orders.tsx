import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SwipeableRow, SwipeActions } from '../../components/SwipeableRow';
import { IOSActionSheet, IOSActionSheetOption } from '../../components/IOSActionSheet';
import { IOSRefreshControl } from '../../components/IOSRefreshControl';
import { theme } from '../../theme/theme';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../lib/sharedStyles';

interface Order {
  id: string;
  title?: string;
  from_address?: string;
  to_address?: string;
  cargo_title?: string;
  cargo_type?: string;
  pickup_date?: string;
  total_amount?: number;
  platform_fee?: number;
  carrier_amount?: number;
  payment_status?: string;
  status: string;
  created_at: string;
  customer_id?: string;
  carrier_id?: string;
  cancelled_at?: string;
  accepted_bid_id?: string;
  cargo_requests?: {
    title: string;
    from_address: string;
    to_address: string;
    cargo_type: string;
    pickup_date: string;
  };
  customer?: {
    id?: string;
    full_name: string;
    phone?: string;
    avatar_url?: string;
  };
  carrier?: {
    full_name: string;
    phone?: string;
    avatar_url?: string;
  };
  bids?: Array<{
    id: string;
    price: number;
    status: string;
    carrier?: {
      id: string;
      full_name: string;
      avatar_url?: string;
    };
  }>;
  accepted_bid?: {
    price: number;
    carrier: any;
  };
  escrow_payments?: {
    status: string;
  }[];
}

function OrdersScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'customer' | 'carrier'>('customer');
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'status' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter orders - hide cancelled orders older than 2 days
  const filterOrders = (orders: Order[]) => {
    const now = new Date();
    return orders.filter(order => {
      if (order.status === 'cancelled' && order.cancelled_at) {
        const cancelledDate = new Date(order.cancelled_at);
        const diffDays = (now.getTime() - cancelledDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 2; // Show only for 2 days after cancellation
      }
      return true;
    });
  };

  // Apply filters and sorting
  const getFilteredAndSortedOrders = (orders: Order[]) => {
    // First apply the existing filter (hide old cancelled orders)
    let filtered = filterOrders(orders);

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(order => {
        switch (filterStatus) {
          case 'active':
            return ['pending', 'active', 'in_transit'].includes(order.status);
          case 'delivered':
            return order.status === 'delivered';
          case 'completed':
            return order.status === 'completed';
          case 'cancelled':
            return order.status === 'cancelled';
          case 'pending_payment':
            return order.payment_status === 'pending';
          case 'paid':
            return order.payment_status === 'paid';
          default:
            return true;
        }
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          comparison = dateA - dateB;
          break;

        case 'status':
          const statusOrder: { [key: string]: number } = {
            pending: 1,
            active: 2,
            in_transit: 3,
            delivered: 4,
            completed: 5,
            cancelled: 6,
          };
          comparison = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
          break;

        case 'amount':
          const amountA = a.total_amount || a.accepted_bid?.price || 0;
          const amountB = b.total_amount || b.accepted_bid?.price || 0;
          comparison = amountA - amountB;
          break;

        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      if (!user?.uid) {
        setOrders([]);
        setLoading(false);
        return;
      }

      if (activeTab === 'customer') {
        // Orders where user is CUSTOMER - from cargo_requests with bids
        try {
          const requestsQuery = query(
            collection(db, 'cargo_requests'),
            where('user_id', '==', user.uid),
            orderBy('created_at', 'desc')
          );

          const requestsSnapshot = await getDocs(requestsQuery);
          const requestsData = await Promise.all(
            requestsSnapshot.docs.map(async docSnapshot => {
              const requestData = docSnapshot.data();

              // Fetch user data
              let customerData = { id: user.uid, full_name: 'Unknown', avatar_url: '' };
              if (requestData.user_id) {
                const userDoc = await getDoc(doc(db, 'users', requestData.user_id));
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  customerData = {
                    id: userDoc.id,
                    full_name: userData.full_name || 'Unknown',
                    avatar_url: userData.avatar_url || '',
                  };
                }
              }

              // Fetch bids for this request
              const bidsQuery = query(
                collection(db, 'bids'),
                where('cargo_request_id', '==', docSnapshot.id)
              );
              const bidsSnapshot = await getDocs(bidsQuery);
              const bidsData = await Promise.all(
                bidsSnapshot.docs.map(async bidDoc => {
                  const bidData = bidDoc.data();

                  // Fetch carrier data for each bid
                  let carrierData = { id: '', full_name: 'Unknown', avatar_url: '' };
                  if (bidData.carrier_id) {
                    const carrierDoc = await getDoc(doc(db, 'users', bidData.carrier_id));
                    if (carrierDoc.exists()) {
                      const carrier = carrierDoc.data();
                      carrierData = {
                        id: carrierDoc.id,
                        full_name: carrier.full_name || 'Unknown',
                        avatar_url: carrier.avatar_url || '',
                      };
                    }
                  }

                  return {
                    id: bidDoc.id,
                    price: bidData.price,
                    status: bidData.status,
                    carrier: carrierData,
                  };
                })
              );

              return {
                id: docSnapshot.id,
                ...requestData,
                customer: customerData,
                bids: bidsData,
                created_at:
                  requestData.created_at?.toDate?.()?.toISOString() || requestData.created_at,
              };
            })
          );

          const uniqueOrders = removeDuplicates(requestsData || [], 'id');
          const filteredOrders = filterOrders(uniqueOrders);
          setOrders(filteredOrders);
        } catch (error) {
          console.error('Error fetching customer orders:', error);
          setOrders([]);
        }
      } else {
        // Orders where user is CARRIER - query from bids table
        try {
          const bidsQuery = query(
            collection(db, 'bids'),
            where('carrier_id', '==', user.uid),
            where('status', '==', 'accepted')
          );

          const bidsSnapshot = await getDocs(bidsQuery);

          console.log('Carrier bids found:', bidsSnapshot.docs.length, { userId: user.uid });

          if (bidsSnapshot.empty) {
            console.log('No accepted bids found for carrier');
            setOrders([]);
          } else {
            const formattedOrders = await Promise.all(
              bidsSnapshot.docs.map(async bidDoc => {
                const bidData = bidDoc.data();

                // Fetch cargo request
                let requestData: any = {};
                if (bidData.cargo_request_id) {
                  const requestDoc = await getDoc(
                    doc(db, 'cargo_requests', bidData.cargo_request_id)
                  );
                  if (requestDoc.exists()) {
                    requestData = { id: requestDoc.id, ...requestDoc.data() };

                    // Fetch customer data
                    if (requestData.user_id) {
                      const customerDoc = await getDoc(doc(db, 'users', requestData.user_id));
                      if (customerDoc.exists()) {
                        const customerData = customerDoc.data();
                        requestData.customer = {
                          id: customerDoc.id,
                          full_name: customerData.full_name || 'Unknown',
                          avatar_url: customerData.avatar_url || '',
                        };
                      }
                    }
                  }
                }

                return {
                  ...requestData,
                  accepted_bid: {
                    id: bidDoc.id,
                    price: bidData.price,
                    carrier: null,
                  },
                  created_at:
                    requestData.created_at?.toDate?.()?.toISOString() || requestData.created_at,
                };
              })
            );

            console.log('Formatted carrier orders:', formattedOrders.length);

            // Remove duplicates
            const uniqueOrders = removeDuplicates(formattedOrders, 'id');
            const filteredOrders = filterOrders(uniqueOrders);
            setOrders(filteredOrders);
          }
        } catch (error) {
          console.error('Error fetching carrier orders:', error);
          setOrders([]);
        }
      }
    } catch (error) {
      console.error('Error in fetchOrders:', error);
      Alert.alert(t('error'), 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Function to remove duplicates
  const removeDuplicates = (array: any[], key: string) => {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleOrderPress = (order: Order) => {
    // Check if this is a cargo_request (no order record yet) or an actual order
    // If user is customer and viewing cargo_requests, go to request-details
    // If user is carrier with accepted bid, go to request-details
    // Only navigate to order-status if an actual order with payment exists

    if (activeTab === 'carrier') {
      // Carrier viewing their accepted bids - show request details
      router.push(`/request-details/${order.id}` as any);
    } else {
      // Customer viewing their cargo requests
      // Check if there's a paid order or just a request
      // For now, navigate to request-details since we're fetching cargo_requests
      router.push(`/request-details/${order.id}` as any);
    }
  };

  const getCargoTypeIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      furniture: 'bed-outline',
      electronics: 'phone-portrait-outline',
      construction: 'construct-outline',
      automotive: 'car-outline',
      boats: 'boat-outline',
      campingvogn: 'home-outline',
      machinery: 'build-outline',
      other: 'cube-outline',
    };
    return icons[type] || 'cube-outline';
  };

  // Helper function to get address with fallback
  const getFromAddress = (order: Order) => {
    return order.from_address || order.cargo_requests?.from_address || t('addressNotAvailable');
  };

  const getToAddress = (order: Order) => {
    return order.to_address || order.cargo_requests?.to_address || t('addressNotAvailable');
  };

  const getCargoTitle = (order: Order) => {
    return order.cargo_title || order.cargo_requests?.title || t('deletedRequest');
  };

  const getCargoType = (order: Order) => {
    return order.cargo_type || order.cargo_requests?.cargo_type || 'other';
  };

  const getTransporterName = (order: any) => {
    if (activeTab === 'customer') {
      // For customer, show carrier from accepted bid (status = 'accepted')
      const acceptedBid = order.bids?.find((bid: any) => bid.status === 'accepted');
      return acceptedBid?.carrier?.full_name || t('waiting');
    }
    return t('you') || 'Deg'; // For carrier - it's yourself
  };

  const getOrderPrice = (order: any) => {
    if (activeTab === 'customer') {
      // For customer, check for accepted bid price first
      const acceptedBid = order.bids?.find((bid: any) => bid.status === 'accepted');
      if (acceptedBid?.price) return acceptedBid.price;
    }
    // Otherwise return accepted_bid price, total_amount, or price
    return order.accepted_bid?.price || order.total_amount || order.price || null;
  };

  const getBidsCount = (order: any) => {
    return order.bids?.length || 0;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    const statusColors: { [key: string]: { bg: string; text: string; icon: string } } = {
      pending: { bg: '#FEF3C7', text: '#92400E', icon: 'time-outline' },
      active: { bg: '#DBEAFE', text: '#1E40AF', icon: 'checkmark-circle-outline' },
      in_transit: { bg: '#E0E7FF', text: '#3730A3', icon: 'car-outline' },
      delivered: { bg: '#D1FAE5', text: '#065F46', icon: 'checkmark-done-outline' },
      cancelled: { bg: '#FEE2E2', text: '#991B1B', icon: 'close-circle-outline' },
    };
    return statusColors[status] || statusColors.pending;
  };

  const isCustomer = activeTab === 'customer';

  const handleCancelOrder = async (orderId: string) => {
    try {
      let updateData: any = { status: 'cancelled' };

      // If carrier is cancelling, set cancelled_at for 2-day cleanup
      if (!isCustomer) {
        updateData.cancelled_at = new Date().toISOString();
      }

      await updateDoc(doc(db, 'cargo_requests', orderId), updateData);

      // If customer cancels, delete immediately
      if (isCustomer) {
        await deleteDoc(doc(db, 'cargo_requests', orderId));
      }

      fetchOrders(); // refresh list
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      Alert.alert(t('error'), t('failedToCancel'));
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, 'cargo_requests', orderId));
      fetchOrders(); // refresh list
    } catch (error: any) {
      console.error('Error deleting order:', error);
      Alert.alert(t('error'), t('failedToDelete'));
    }
  };

  const showOrderActions = (order: Order) => {
    setSelectedOrder(order);
    setActionSheetVisible(true);
  };

  const getOrderActions = (): IOSActionSheetOption[] => {
    if (!selectedOrder) return [];

    const actions: IOSActionSheetOption[] = [
      {
        title: t('viewDetails'),
        icon: 'eye-outline',
        onPress: () => handleOrderPress(selectedOrder),
      },
    ];

    if (selectedOrder.status === 'active' || selectedOrder.status === 'in_transit') {
      if (isCustomer) {
        actions.push({
          title: t('cancelOrder'),
          icon: 'close-circle-outline',
          destructive: true,
          onPress: () => handleCancelOrder(selectedOrder.id),
        });
      } else {
        actions.push({
          title: t('deleteOrder'),
          icon: 'trash-outline',
          destructive: true,
          onPress: () => handleDeleteOrder(selectedOrder.id),
        });
      }
    }

    if (selectedOrder.status === 'delivered' && isCustomer) {
      actions.push({
        title: t('deleteOrder'),
        icon: 'trash-outline',
        destructive: true,
        onPress: () => handleDeleteOrder(selectedOrder.id),
      });
    }

    return actions;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>{t('orders')}</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNavigationContainer}>
        <View style={styles.tabNavigation}>
          <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('customer')}>
            <Text style={[styles.tabText, activeTab === 'customer' && styles.activeTabText]}>
              {t('asCustomer')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('carrier')}>
            <Text style={[styles.tabText, activeTab === 'carrier' && styles.activeTabText]}>
              {t('asCarrier')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters and Sorting */}
      {orders.length > 0 && (
        <View style={styles.filtersContainer}>
          {/* Status Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}
          >
            <TouchableOpacity
              style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}
              onPress={() => setFilterStatus('all')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterStatus === 'all' && styles.filterChipTextActive,
                ]}
              >
                {t('all') || 'Alle'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filterStatus === 'active' && styles.filterChipActive]}
              onPress={() => setFilterStatus('active')}
            >
              <Ionicons
                name="pulse"
                size={14}
                color={filterStatus === 'active' ? colors.white : colors.primary}
                style={styles.filterChipIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filterStatus === 'active' && styles.filterChipTextActive,
                ]}
              >
                {t('active') || 'Aktive'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filterStatus === 'delivered' && styles.filterChipActive]}
              onPress={() => setFilterStatus('delivered')}
            >
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={filterStatus === 'delivered' ? colors.white : colors.success}
                style={styles.filterChipIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filterStatus === 'delivered' && styles.filterChipTextActive,
                ]}
              >
                {t('delivered') || 'Levert'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filterStatus === 'completed' && styles.filterChipActive]}
              onPress={() => setFilterStatus('completed')}
            >
              <Ionicons
                name="checkmark-done"
                size={14}
                color={filterStatus === 'completed' ? colors.white : colors.success}
                style={styles.filterChipIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filterStatus === 'completed' && styles.filterChipTextActive,
                ]}
              >
                {t('completed') || 'Fullført'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filterStatus === 'cancelled' && styles.filterChipActive]}
              onPress={() => setFilterStatus('cancelled')}
            >
              <Ionicons
                name="close-circle"
                size={14}
                color={filterStatus === 'cancelled' ? colors.white : colors.error}
                style={styles.filterChipIcon}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filterStatus === 'cancelled' && styles.filterChipTextActive,
                ]}
              >
                {t('cancelled') || 'Avbrutt'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Sort Controls */}
          <View style={styles.sortControls}>
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => {
                if (sortBy === 'date') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('date');
                  setSortOrder('desc');
                }
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={sortBy === 'date' ? colors.primary : colors.text.secondary}
              />
              {sortBy === 'date' && (
                <Ionicons
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={colors.primary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => {
                if (sortBy === 'status') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('status');
                  setSortOrder('asc');
                }
              }}
            >
              <Ionicons
                name="list-outline"
                size={16}
                color={sortBy === 'status' ? colors.primary : colors.text.secondary}
              />
              {sortBy === 'status' && (
                <Ionicons
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={colors.primary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => {
                if (sortBy === 'amount') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy('amount');
                  setSortOrder('desc');
                }
              }}
            >
              <Ionicons
                name="cash-outline"
                size={16}
                color={sortBy === 'amount' ? colors.primary : colors.text.secondary}
              />
              {sortBy === 'amount' && (
                <Ionicons
                  name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={colors.primary}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<IOSRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{t('loading')}</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="receipt-outline" size={64} color={colors.text.secondary} />
            </View>
            <Text style={styles.emptyTitle}>
              {isCustomer ? t('noCustomerOrders') : t('noCarrierOrders')}
            </Text>
            <Text style={styles.emptySubtitle}>
              {isCustomer ? t('createRequestToSeeOrders') : t('acceptBidsToSeeOrders')}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={() => router.push('/(tabs)/home')}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.white} />
              <Text style={styles.emptyActionText}>
                {isCustomer
                  ? t('createRequest') || 'Opprett forespørsel'
                  : t('viewRequests') || 'Se forespørsler'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {getFilteredAndSortedOrders(orders).map(order => {
              const swipeActions = [];

              // Right swipe actions
              if (order.status === 'active' || order.status === 'in_transit') {
                if (isCustomer) {
                  swipeActions.push(SwipeActions.cancel(() => handleCancelOrder(order.id)));
                } else {
                  swipeActions.push(SwipeActions.delete(() => handleDeleteOrder(order.id)));
                }
              }

              if (order.status === 'delivered' && isCustomer) {
                swipeActions.push(SwipeActions.delete(() => handleDeleteOrder(order.id)));
              }

              const statusColor = getStatusColor(order.status);
              const orderPrice = getOrderPrice(order);
              const bidsCount = getBidsCount(order);

              return (
                <SwipeableRow key={order.id} rightActions={swipeActions}>
                  <TouchableOpacity
                    style={styles.orderCard}
                    onPress={() => handleOrderPress(order)}
                    onLongPress={() => showOrderActions(order)}
                  >
                    {/* Status Badge at Top */}
                    <View style={[styles.statusBadgeTop, { backgroundColor: statusColor.bg }]}>
                      <Ionicons name={statusColor.icon as any} size={16} color={statusColor.text} />
                      <Text style={[styles.statusTextTop, { color: statusColor.text }]}>
                        {t(order.status)}
                      </Text>
                    </View>

                    {/* Order Header */}
                    <View style={styles.orderHeader}>
                      <View style={styles.orderInfo}>
                        <View style={styles.cargoTypeContainer}>
                          <View style={styles.cargoIconCircle}>
                            <Ionicons
                              name={getCargoTypeIcon(getCargoType(order)) as any}
                              size={24}
                              color={colors.text.secondary}
                            />
                          </View>
                          <View style={styles.cargoDetails}>
                            <Text style={styles.orderTitle}>{getCargoTitle(order)}</Text>
                            <Text style={styles.cargoType}>
                              {t(order.cargo_type || order.cargo_requests?.cargo_type || 'other')}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.amountContainer}>
                        {orderPrice ? (
                          <Text style={styles.amount}>{orderPrice} NOK</Text>
                        ) : (
                          <View style={styles.noPriceContainer}>
                            <Text style={styles.noPriceText}>
                              {t('noBidsYet') || 'Ingen bud ennå'}
                            </Text>
                          </View>
                        )}
                        {activeTab === 'customer' && bidsCount > 0 && (
                          <View style={styles.bidsCountBadge}>
                            <Ionicons name="pricetag" size={12} color={colors.primary} />
                            <Text style={styles.bidsCountText}>
                              {bidsCount} {bidsCount === 1 ? 'bud' : 'bud'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Route */}
                    <View style={styles.routeContainer}>
                      <View style={styles.routeRow}>
                        <View style={styles.locationDot} />
                        <View style={styles.routeInfo}>
                          <Text style={styles.routeLabel}>{t('from') || 'Fra'}</Text>
                          <Text style={styles.routeText} numberOfLines={1}>
                            {getFromAddress(order)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.routeLine} />
                      <View style={styles.routeRow}>
                        <View style={[styles.locationDot, styles.locationDotEnd]} />
                        <View style={styles.routeInfo}>
                          <Text style={styles.routeLabel}>{t('to') || 'Til'}</Text>
                          <Text style={styles.routeText} numberOfLines={1}>
                            {getToAddress(order)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Participants */}
                    <View style={styles.participantsContainer}>
                      <View style={styles.participant}>
                        <View style={styles.participantIconCircle}>
                          <Ionicons name="person-outline" size={16} color={colors.text.secondary} />
                        </View>
                        <View style={styles.participantInfo}>
                          <Text style={styles.participantLabel}>{t('customer')}</Text>
                          <Text style={styles.participantName}>
                            {order.customer?.full_name || 'N/A'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.participant}>
                        <View style={styles.participantIconCircle}>
                          <Ionicons name="car-outline" size={16} color={colors.text.secondary} />
                        </View>
                        <View style={styles.participantInfo}>
                          <Text style={styles.participantLabel}>{t('carrier')}</Text>
                          <Text
                            style={[
                              styles.participantName,
                              getTransporterName(order) === t('waiting') &&
                                styles.participantNameWaiting,
                            ]}
                          >
                            {getTransporterName(order)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Order Footer */}
                    <View style={styles.orderFooter}>
                      <Text style={styles.orderDate}>
                        {t('created')}: {formatDate(order.created_at)}
                      </Text>
                      <Text style={styles.pickupDate}>
                        {t('pickup')}:{' '}
                        {order.pickup_date
                          ? formatDate(order.pickup_date)
                          : t('requestNotAvailable')}
                      </Text>
                    </View>

                    {/* Escrow Status */}
                    {order.escrow_payments && order.escrow_payments.length > 0 && (
                      <View style={styles.escrowContainer}>
                        <Ionicons
                          name="shield-checkmark"
                          size={16}
                          color={theme.iconColors.success}
                        />
                        <Text style={styles.escrowText}>
                          {t('escrowStatus')}: {t(order.escrow_payments[0].status)}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </SwipeableRow>
              );
            })}
          </View>
        )}

        {/* Bottom spacing for tab bar */}
        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>

      {/* Action Sheet */}
      <IOSActionSheet
        visible={actionSheetVisible}
        onClose={() => {
          setActionSheetVisible(false);
          setSelectedOrder(null);
        }}
        title={selectedOrder?.cargo_title || selectedOrder?.cargo_requests?.title}
        message={t('chooseAction')}
        options={getOrderActions()}
        cancelText={t('cancel')}
      />
    </View>
  );
}

export default OrdersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  tabNavigationContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    paddingTop: spacing.lg,
  },
  tabNavigation: {
    flexDirection: 'row',
    position: 'relative',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: colors.badge.background,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  tabText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  filtersContainer: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.md,
  },
  filtersScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing.xs,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipIcon: {
    marginRight: -2,
  },
  filterChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  sortControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: 4,
    minWidth: 48,
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  emptyTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
    ...shadows.md,
  },
  emptyActionText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  ordersList: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.xs,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  statusBadgeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  statusTextTop: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textTransform: 'capitalize',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  orderInfo: {
    flex: 1,
  },
  cargoTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cargoIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  cargoDetails: {
    flex: 1,
  },
  cargoType: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.badge.background,
  },
  statusText: {
    fontSize: fontSize.xs,
    color: colors.badge.text,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  orderTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    lineHeight: 22,
  },
  amountContainer: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  amount: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.status.success,
  },
  noPriceContainer: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  noPriceText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.tertiary,
  },
  bidsCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight || '#F0F9FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  bidsCountText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  paymentStatus: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  routeContainer: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  locationDotEnd: {
    backgroundColor: colors.status.success,
    shadowColor: colors.status.success,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: colors.border.light,
    marginLeft: 5,
    marginVertical: 4,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  routeText: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  participantsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  participant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  participantIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  participantInfo: {
    flex: 1,
  },
  participantLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  participantName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: 2,
  },
  participantNameWaiting: {
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  orderDate: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  pickupDate: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  escrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  escrowText: {
    fontSize: fontSize.xs,
    color: colors.status.success,
    marginLeft: spacing.sm,
    fontWeight: fontWeight.semibold,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    gap: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.error,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    minWidth: 80,
    justifyContent: 'center',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.warning,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    minWidth: 80,
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
    marginLeft: spacing.sm,
    fontSize: fontSize.sm,
  },
});
