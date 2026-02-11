import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  Animated,
  Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../../hooks/useDebounce';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, QueryConstraint } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { theme } from '../../theme/theme';

interface MapOrder {
  id: string;
  from_address: string;
  to_address: string;
  from_lat?: number;
  from_lng?: number;
  to_lat?: number;
  to_lng?: number;
  cargo_title: string;
  cargo_type: string;
  status: string;
  total_amount: number;
}

export default function MapScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<MapOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const screenHeight = Dimensions.get('window').height;
  const bottomSheetHeight = useRef(new Animated.Value(screenHeight * 0.3)).current;
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const fetchOrders = async () => {
    try {
      if (!user?.uid) {
        setOrders([]);
        return;
      }

      const ordersRef = collection(db, 'orders');
      const constraints: QueryConstraint[] = [];

      if (filterStatus !== 'all') {
        constraints.push(where('status', '==', filterStatus));
      }

      const customerQuery = query(ordersRef, where('customer_id', '==', user.uid), ...constraints);
      const carrierQuery = query(ordersRef, where('carrier_id', '==', user.uid), ...constraints);

      const [customerSnap, carrierSnap] = await Promise.all([
        getDocs(customerQuery),
        getDocs(carrierQuery),
      ]);

      const seenIds = new Set<string>();
      const mergedDocs = [...customerSnap.docs, ...carrierSnap.docs].filter(doc => {
        if (seenIds.has(doc.id)) return false;
        seenIds.add(doc.id);
        return true;
      });

      const data = mergedDocs
        .map(doc => ({ ...(doc.data() as MapOrder), id: doc.id }))
        .filter(order => order.from_lat != null && order.from_lng != null);

      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      Alert.alert(t('error'), 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderPress = (orderId: string) => {
    router.push(`/order-status/${orderId}` as any);
  };

  const filteredOrders = orders.filter(
    order =>
      order.cargo_title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      order.from_address.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      order.to_address.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      active: '#FFC107', // Warning yellow
      in_transit: '#FF8A65', // Secondary orange
      delivered: '#4CAF50', // Success green
      cancelled: '#F44336', // Error red
    };
    return colors[status] || '#616161'; // Text secondary
  };

  const toggleBottomSheet = () => {
    const newHeight = isExpanded ? screenHeight * 0.3 : screenHeight * 0.7;

    Animated.spring(bottomSheetHeight, {
      toValue: newHeight,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();

    setIsExpanded(!isExpanded);
  };

  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      const newValue = screenHeight - event.absoluteY;
      if (newValue >= screenHeight * 0.3 && newValue <= screenHeight * 0.8) {
        bottomSheetHeight.setValue(newValue);
      }
    })
    .onEnd(event => {
      const velocity = event.velocityY;
      const currentHeight = screenHeight - event.absoluteY;

      if (velocity > 500 || currentHeight < screenHeight * 0.45) {
        // Collapse
        Animated.spring(bottomSheetHeight, {
          toValue: screenHeight * 0.3,
          useNativeDriver: false,
        }).start();
        setIsExpanded(false);
      } else {
        // Expand
        Animated.spring(bottomSheetHeight, {
          toValue: screenHeight * 0.7,
          useNativeDriver: false,
        }).start();
        setIsExpanded(true);
      }
    });

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView style={styles.map} showsUserLocation={true} showsMyLocationButton={true}>
        {filteredOrders.map(order => (
          <React.Fragment key={order.id}>
            <Marker
              coordinate={{
                latitude: order.from_lat || 59.91,
                longitude: order.from_lng || 10.75,
              }}
              title={`${t('from')}: ${order.from_address}`}
              description={order.cargo_title}
              onPress={() => handleOrderPress(order.id)}
            >
              <View style={[styles.marker, { backgroundColor: getStatusColor(order.status) }]}>
                <Ionicons name="location-outline" size={14} color={theme.iconColors.white} />
              </View>
            </Marker>

            {order.to_lat && order.to_lng && (
              <Marker
                coordinate={{
                  latitude: order.to_lat,
                  longitude: order.to_lng,
                }}
                title={`${t('to')}: ${order.to_address}`}
                description={`${order.total_amount} NOK`}
                onPress={() => handleOrderPress(order.id)}
              >
                <View style={[styles.marker, { backgroundColor: '#FF8A65' }]}>
                  <Ionicons name="flag-outline" size={14} color={theme.iconColors.white} />
                </View>
              </Marker>
            )}

            {order.from_lat && order.from_lng && order.to_lat && order.to_lng && (
              <Polyline
                coordinates={[
                  { latitude: order.from_lat, longitude: order.from_lng },
                  { latitude: order.to_lat, longitude: order.to_lng },
                ]}
                strokeColor={getStatusColor(order.status)}
                strokeWidth={4}
              />
            )}
          </React.Fragment>
        ))}
      </MapView>

      {/* iOS-style search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.iconColors.gray.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('searchOrders')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* iOS-style segmented control */}
        <View style={styles.segmentedControl}>
          {['all', 'active', 'delivered'].map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.segmentButton, filterStatus === status && styles.segmentButtonActive]}
              onPress={() => setFilterStatus(status)}
            >
              <Text
                style={[styles.segmentText, filterStatus === status && styles.segmentTextActive]}
              >
                {t(status)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* iOS-style bottom sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.bottomSheet, { height: bottomSheetHeight }]}>
          {/* Handle */}
          <View style={styles.bottomSheetHandle} />

          {/* Header */}
          <View style={styles.bottomSheetHeader}>
            <Text style={styles.bottomSheetTitle}>
              {t('orders')} ({filteredOrders.length})
            </Text>
            <TouchableOpacity onPress={toggleBottomSheet}>
              <Ionicons
                name={isExpanded ? 'chevron-down' : 'chevron-up'}
                size={24}
                color={theme.iconColors.gray.primary}
              />
            </TouchableOpacity>
          </View>

          {/* Orders List */}
          <ScrollView
            style={styles.ordersList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>{t('loading')}</Text>
              </View>
            ) : filteredOrders.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="map-outline" size={48} color={theme.iconColors.gray.primary} />
                <Text style={styles.emptyTitle}>{t('noOrdersFound')}</Text>
                <Text style={styles.emptySubtitle}>{t('tryDifferentSearch')}</Text>
              </View>
            ) : (
              filteredOrders.map(order => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => handleOrderPress(order.id)}
                >
                  <View style={styles.orderCardHeader}>
                    <View style={styles.orderInfo}>
                      <Text style={styles.orderTitle} numberOfLines={1}>
                        {order.cargo_title}
                      </Text>
                      <Text style={styles.orderType}>{t(order.cargo_type)}</Text>
                    </View>
                    <View style={styles.orderAmount}>
                      <Text style={styles.amountText}>{order.total_amount} NOK</Text>
                      <View
                        style={[
                          styles.statusIndicator,
                          { backgroundColor: getStatusColor(order.status) },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.routeInfo}>
                    <View style={styles.routePoint}>
                      <Ionicons name="location" size={14} color={theme.iconColors.success} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        {order.from_address}
                      </Text>
                    </View>
                    <Ionicons
                      name="arrow-forward"
                      size={12}
                      color={theme.iconColors.gray.primary}
                    />
                    <View style={styles.routePoint}>
                      <Ionicons name="location" size={14} color={theme.iconColors.error} />
                      <Text style={styles.routeText} numberOfLines={1}>
                        {order.to_address}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  map: {
    flex: 1,
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  searchContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#212121',
    marginLeft: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FF7043',
    shadowColor: '#FF7043',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616161',
  },
  segmentTextActive: {
    color: 'white',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  ordersList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  orderType: {
    fontSize: 12,
    color: '#FF7043',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  orderAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routePoint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeText: {
    fontSize: 14,
    color: '#616161',
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#616161',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#616161',
    marginTop: 4,
    textAlign: 'center',
  },
});
