import React, { useState, useEffect, type ComponentProps } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ImageStyle,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { theme } from '../../theme/theme';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../lib/sharedStyles';
import { releaseFundsToCarrier } from '../../utils/escrowManagement';
import { uploadDeliveryProof } from '../../utils/deliveryProof';
import * as ImagePicker from 'expo-image-picker';
import SignaturePad from '../../components/SignaturePad';
import { LazyImage } from '../../components/LazyImage';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SkeletonLoader } from '../../components/SkeletonLoader';

interface Order {
  id: string;
  total_amount: number;
  platform_fee: number;
  carrier_amount: number;
  payment_status: string;
  status: string;
  created_at: string;
  customer_id: string;
  carrier_id: string;
  request_id: string;
  bid_id: string;
  cargo_requests?: {
    title: string;
    from_address: string;
    to_address: string;
    cargo_type: string;
  } | null;
  customer: {
    full_name: string;
    phone: string;
  };
  carrier: {
    full_name: string;
    phone: string;
  };
  escrow_payments?: EscrowPayment[];
  delivery_photos?: string[];
  delivery_signature?: string;
  delivery_time?: Date | { seconds: number } | string | null;
}

type EscrowPayment = {
  id: string;
  status?: string;
  vipps_order_id?: string;
};

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export default function OrderStatusScreen() {
  const { orderId } = useLocalSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, authLoading, router]);

  // Delivery Proof State
  const [deliveryPhotos, setDeliveryPhotos] = useState<string[]>([]);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [signatureError, setSignatureError] = useState(false);

  const locale = i18n.language.startsWith('no') ? 'nb-NO' : 'en-US';

  const normalizeStatus = (value: string | undefined | null) =>
    String(value || '')
      .trim()
      .toLowerCase();

  const formatNokAmount = (value: number) => {
    const formatted = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
    return `${formatted} kr`;
  };

  const formatDateTime = (value: Date | string) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleString(locale);
  };

  const getOrderStatusLabel = (status: string) => {
    const normalized = normalizeStatus(status);
    const map: Record<string, string> = {
      pending_payment: 'pending_payment',
      paid: 'paid',
      active: 'active',
      in_transit: 'in_transit',
      in_progress: 'in_transit',
      delivered: 'delivered',
      completed: 'completed',
      cancelled: 'cancelled',
      canceled: 'cancelled',
      disputed: 'disputed',
      refunded: 'refunded',
      pending: 'pending',
    };
    return t(map[normalized] || normalized);
  };

  const getStatusSubtitle = (status: string) => {
    const normalized = normalizeStatus(status);
    const map: Record<string, string> = {
      pending_payment: 'awaitingPayment',
      paid: 'waitingForCarrier',
      active: 'waitingForCarrier',
      in_transit: 'cargoInTransit',
      in_progress: 'cargoInTransit',
      delivered: 'cargoDelivered',
      completed: 'cargoDelivered',
      cancelled: 'orderCancelled',
      canceled: 'orderCancelled',
      disputed: 'orderDisputed',
      refunded: 'orderRefunded',
    };

    const key = map[normalized];
    return key ? t(key) : '';
  };

  const getPaymentStatusColor = (status: string) => {
    const normalized = normalizeStatus(status);
    if (normalized === 'completed' || normalized === 'paid' || normalized === 'released') {
      return '#10B981';
    }
    if (normalized === 'failed' || normalized === 'refunded') {
      return '#F44336';
    }
    return '#F59E0B';
  };

  // Ensure orderId is a string
  const orderIdString = Array.isArray(orderId) ? orderId[0] : orderId;

  // Initial data fetch for related documents (cargo, users)
  useEffect(() => {
    if (!orderIdString) {
      setLoading(false);
      return;
    }
    fetchRelatedData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIdString]);

  // Real-time listener for order updates
  useEffect(() => {
    if (!orderIdString) {
      return;
    }

    const orderChannel = supabase
      .channel(`order:${orderIdString}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderIdString}`,
        },
        async () => {
          await fetchRelatedData();
          setLastUpdated(new Date());
        }
      )
      .subscribe();

    const escrowChannel = supabase
      .channel(`escrow:${orderIdString}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'escrow_payments',
          filter: `order_id=eq.${orderIdString}`,
        },
        async () => {
          await fetchRelatedData();
          setLastUpdated(new Date());
        }
      )
      .subscribe();

    return () => {
      orderChannel.unsubscribe();
      escrowChannel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIdString]);

  const fetchRelatedData = async () => {
    if (!orderIdString) {
      setLoading(false);
      return;
    }

    try {
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderIdString)
        .maybeSingle();

      if (orderError) {
        throw orderError;
      }

      if (!orderRow) {
        Alert.alert(t('error'), t('orderNotFound') || 'Order not found');
        return;
      }

      const orderData = {
        id: orderRow.id,
        ...(orderRow as unknown as Omit<Order, 'id'>),
      };

      // Fetch cargo request
      if (orderData.request_id) {
        const { data: requestRow } = await supabase
          .from('cargo_requests')
          .select('title, from_address, to_address, cargo_type')
          .eq('id', orderData.request_id)
          .maybeSingle();
        if (requestRow) {
          orderData.cargo_requests = requestRow as Order['cargo_requests'];
        }
      }

      // Fetch customer data
      if (orderData.customer_id) {
        const { data: customerRow } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', orderData.customer_id)
          .maybeSingle();
        if (customerRow) {
          orderData.customer = customerRow as Order['customer'];
        }
      }

      // Fetch carrier data
      if (orderData.carrier_id) {
        const { data: carrierRow } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', orderData.carrier_id)
          .maybeSingle();
        if (carrierRow) {
          orderData.carrier = carrierRow as Order['carrier'];
        }
      }

      // Fetch escrow payments
      const { data: escrowRows } = await supabase
        .from('escrow_payments')
        .select('id,status,provider_order_id')
        .eq('order_id', orderIdString);
      orderData.escrow_payments = (escrowRows || []).map(row => ({
        id: row.id,
        status: row.status,
        vipps_order_id: row.provider_order_id || undefined,
      }));

      setOrder(orderData);
    } catch (error: unknown) {
      console.error('Error fetching order:', error);
      const message = error instanceof Error ? error.message : 'Failed to load order details';
      Alert.alert(t('error'), message);
    } finally {
      setLoading(false);
    }
  };

  // Take photo for delivery proof
  const takePhoto = async () => {
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('error'), t('cameraPermissionRequired'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setDeliveryPhotos([...deliveryPhotos, result.assets[0].uri]);
      }
    } catch (error: unknown) {
      console.error('Error taking photo:', error);
      Alert.alert(t('error'), t('failedToTakePhoto'));
    }
  };

  // Pick photo from gallery
  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('error'), t('galleryPermissionRequired'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newPhotos = result.assets.map(asset => asset.uri);
        setDeliveryPhotos([...deliveryPhotos, ...newPhotos]);
      }
    } catch (error: unknown) {
      console.error('Error picking photo:', error);
      Alert.alert(t('error'), t('failedToPickImage'));
    }
  };

  // Show photo options (camera or gallery)
  const addPhoto = () => {
    if (Platform.OS === 'web') {
      pickPhoto();
      return;
    }

    Alert.alert(t('addPhoto'), t('choosePhotoSource'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('camera'), onPress: takePhoto },
      { text: t('gallery'), onPress: pickPhoto },
    ]);
  };

  // Remove photo from list
  const removePhoto = (index: number) => {
    const updatedPhotos = deliveryPhotos.filter((_, i) => i !== index);
    setDeliveryPhotos(updatedPhotos);
  };

  // Capture signature
  const captureSignature = () => {
    setSignatureModalVisible(true);
  };

  // Save signature from pad
  const saveSignature = (signatureData: string) => {
    setSignature(signatureData);
  };

  // Submit delivery proof
  const submitDeliveryProof = async () => {
    if (deliveryPhotos.length === 0) {
      Alert.alert(t('error'), t('pleaseAddDeliveryPhotos'));
      return;
    }

    if (!signature) {
      Alert.alert(t('error'), t('pleaseAddSignature'));
      return;
    }

    Alert.alert(t('confirmDelivery'), t('confirmDeliveryProofMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('submit'),
        onPress: processDeliveryProofSubmission,
      },
    ]);
  };

  // Process delivery proof submission
  const processDeliveryProofSubmission = async () => {
    if (!signature || deliveryPhotos.length === 0) return;

    setUploadingProof(true);
    try {
      await uploadDeliveryProof(orderIdString as string, deliveryPhotos, signature);

      Alert.alert(t('deliveryConfirmed'), t('deliveryProofSubmitted'), [
        {
          text: t('ok'),
          onPress: () => router.replace('/(tabs)/orders'),
        },
      ]);
    } catch (error: unknown) {
      console.error('Error submitting delivery proof:', error);
      const message = error instanceof Error ? error.message : 'Failed to submit delivery proof';
      Alert.alert(t('error'), message);
    } finally {
      setUploadingProof(false);
    }
  };

  const confirmDelivery = async () => {
    Alert.alert(t('confirmDelivery'), t('confirmDeliveryMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirmDelivery'),
        onPress: processDeliveryConfirmation,
      },
    ]);
  };

  const processDeliveryConfirmation = async () => {
    setConfirming(true);
    try {
      // Advance order to 'completed' via Edge Function (RLS blocks direct customer writes)
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const { error: statusError } = await supabase.functions.invoke('update-order-status', {
        body: { orderId: orderIdString, newStatus: 'completed' },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statusError) throw statusError;

      // Release funds to carrier
      try {
        const result = await releaseFundsToCarrier(orderIdString as string);

        Alert.alert(
          t('deliveryConfirmed'),
          t('deliveryConfirmedWithPayout', { message: result.message }),
          [
            {
              text: t('leaveReview'),
              onPress: () => router.push(`/review/${orderIdString}`),
            },
            {
              text: t('skip'),
              style: 'cancel',
              onPress: () => router.replace('/(tabs)/orders'),
            },
          ]
        );
      } catch (escrowError: unknown) {
        // If fund release fails, still allow the user to continue
        // Admin can manually process the payout
        console.error('Error releasing funds:', escrowError);
        Alert.alert(
          t('deliveryConfirmed'),
          t('deliveryConfirmedPayoutPending'),
          [
            {
              text: t('leaveReview'),
              onPress: () => router.push(`/review/${orderIdString}`),
            },
            {
              text: t('skip'),
              style: 'cancel',
              onPress: () => router.replace('/(tabs)/orders'),
            },
          ]
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('error');
      Alert.alert(t('error'), message);
    } finally {
      setConfirming(false);
    }
  };

  const startTransport = async () => {
    Alert.alert(t('startTransport'), t('startTransportMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('startTransport'),
        onPress: processStartTransport,
      },
    ]);
  };

  const processStartTransport = async () => {
    setConfirming(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('update-order-status', {
        body: { orderId: orderIdString, newStatus: 'in_progress' },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        throw error;
      }

      await supabase
        .from('orders')
        .update({ started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', orderIdString as string);

      await fetchRelatedData();

      Alert.alert(t('success'), t('transportStarted'));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('error');
      Alert.alert(t('error'), message);
    } finally {
      setConfirming(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending_payment: '#9CA3AF', // Grey
      paid: '#FFC107', // Warning yellow
      active: '#FFC107',
      in_transit: '#FF8A65', // Secondary orange
      in_progress: '#FF8A65',
      delivered: '#4CAF50', // Success green
      completed: '#4CAF50',
      cancelled: '#F44336', // Error red
      canceled: '#F44336',
      disputed: '#EF4444', // Red
      refunded: '#6B7280', // Grey
    };
    return colors[normalizeStatus(status)] || '#616161'; // Text secondary
  };

  const getStatusIcon = (status: string): IoniconName => {
    const icons: Record<string, IoniconName> = {
      pending_payment: 'card-outline',
      paid: 'time-outline',
      active: 'time-outline',
      in_transit: 'car-outline',
      in_progress: 'car-outline',
      delivered: 'checkmark-circle-outline',
      completed: 'checkmark-circle-outline',
      cancelled: 'close-circle-outline',
      canceled: 'close-circle-outline',
      disputed: 'alert-circle-outline',
      refunded: 'refresh-circle-outline',
    };
    return icons[normalizeStatus(status)] || 'help-circle-outline';
  };

  const getCargoTypeIcon = (type: string): IoniconName => {
    const icons: Record<string, IoniconName> = {
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

  const getDeliveryTime = (value: Order['delivery_time']) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      return value.toDate();
    }
    if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000);
    }
    return null;
  };

  const isCustomer = order?.customer_id === user?.uid;
  const isCarrier = order?.carrier_id === user?.uid;
  const canFileDispute =
    (isCustomer || isCarrier) &&
    order?.status != null &&
    !['cancelled', 'canceled'].includes(order.status);
  const canStartTransport = isCarrier && order?.status === 'paid';
  const canTrackDelivery = order?.status === 'in_progress' || order?.status === 'delivered';
  const canConfirmDelivery = isCustomer && order?.status === 'delivered';
  const canSubmitProof = isCarrier && order?.status === 'in_progress';
  const paymentStatus = normalizeStatus(order?.payment_status);
  const canOpenPayment =
    isCustomer &&
    paymentStatus !== 'completed' &&
    paymentStatus !== 'paid' &&
    paymentStatus !== 'released';

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScreenHeader title={t('orderStatus')} onBackPress={() => router.back()} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.skeletonContent}>
          <SkeletonLoader variant="stats" count={1} />
          <SkeletonLoader variant="text" count={2} />
          <SkeletonLoader variant="list" count={3} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('orderNotFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const deliveryTime = getDeliveryTime(order.delivery_time);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t('orderStatus')} onBackPress={() => router.back()} />

      {lastUpdated && (
        <View style={styles.liveStatusRow}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.scrollView}>
        {/* Status Card */}
        <View style={styles.section}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIcon, { backgroundColor: getStatusColor(order.status) }]}>
              <Ionicons
                name={getStatusIcon(order.status)}
                size={24}
                color={theme.iconColors.white}
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>{getOrderStatusLabel(order.status)}</Text>
              <Text style={styles.statusSubtitle}>{getStatusSubtitle(order.status)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('paymentInformation')}</Text>

          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>{t('totalAmount')}:</Text>
            <Text style={styles.paymentAmount}>{formatNokAmount(order.total_amount)}</Text>
          </View>

          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>{t('paymentStatus')}:</Text>
            <Text
              style={[styles.paymentStatus, { color: getPaymentStatusColor(order.payment_status) }]}
            >
              {t(normalizeStatus(order.payment_status) || 'pending')}
            </Text>
          </View>

          {order.escrow_payments && order.escrow_payments.length > 0 && (
            <View style={styles.escrowInfo}>
              <Ionicons name="shield-checkmark" size={20} color={theme.iconColors.success} />
              <Text style={styles.escrowText}>{t('fundsInEscrow')}</Text>
            </View>
          )}

          {canOpenPayment && (
            <TouchableOpacity
              style={[styles.trackButton, { marginTop: spacing.lg }]}
              onPress={() => router.push(`/payment/${order.id}` as never)}
            >
              <Ionicons name="card-outline" size={20} color={theme.iconColors.white} />
              <Text style={styles.trackButtonText}>{t('payment')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Order Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('orderDetails')}</Text>

          {order.cargo_requests ? (
            <>
              <View style={styles.orderHeader}>
                <Ionicons
                  name={getCargoTypeIcon(order.cargo_requests.cargo_type)}
                  size={20}
                  color={theme.iconColors.primary}
                />
                <Text style={styles.orderTitle}>{order.cargo_requests.title}</Text>
              </View>

              <View style={styles.routeContainer}>
                <View style={styles.routePoint}>
                  <Ionicons name="location-outline" size={16} color={theme.iconColors.success} />
                  <Text style={styles.routeText}>{order.cargo_requests.from_address}</Text>
                </View>
                <View style={styles.routeArrow}>
                  <Ionicons name="arrow-down" size={16} color={theme.iconColors.gray.primary} />
                </View>
                <View style={styles.routePoint}>
                  <Ionicons name="location-outline" size={16} color={theme.iconColors.error} />
                  <Text style={styles.routeText}>{order.cargo_requests.to_address}</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.missingOrderDetailsText}>{t('orderDetailsNotAvailable')}</Text>
          )}
        </View>

        {/* Participants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('participants')}</Text>

          <View style={styles.participantCard}>
            <View style={styles.participantHeader}>
              <Ionicons name="person-outline" size={20} color={theme.iconColors.gray.primary} />
              <Text style={styles.participantRole}>{t('customer')}</Text>
            </View>
            <Text style={styles.participantName}>{order.customer.full_name}</Text>
          </View>

          <View style={styles.participantCard}>
            <View style={styles.participantHeader}>
              <Ionicons name="car-outline" size={20} color={theme.iconColors.gray.primary} />
              <Text style={styles.participantRole}>{t('carrier')}</Text>
            </View>
            <Text style={styles.participantName}>{order.carrier.full_name}</Text>
          </View>
        </View>

        {/* Start Transport - For Carrier */}
        {canStartTransport && (
          <View style={styles.section}>
            <View style={styles.confirmationHeader}>
              <Ionicons name="play-circle-outline" size={24} color={theme.iconColors.primary} />
              <Text style={styles.confirmationTitle}>{t('startTransport')}</Text>
            </View>
            <Text style={styles.confirmationDescription}>{t('startTransportDescription')}</Text>
            <TouchableOpacity
              style={[styles.confirmButton, confirming && styles.confirmButtonDisabled]}
              onPress={startTransport}
              disabled={confirming}
            >
              {confirming ? (
                <ActivityIndicator size="small" color={theme.iconColors.white} />
              ) : (
                <Text style={styles.confirmButtonText}>{t('startTransport')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery Tracking */}
        {canTrackDelivery && (
          <View style={styles.section}>
            <View style={styles.confirmationHeader}>
              <Ionicons name="navigate-outline" size={24} color={theme.iconColors.primary} />
              <Text style={styles.proofTitle}>{t('deliveryTracking')}</Text>
            </View>
            <Text style={styles.confirmationDescription}>{t('followDriverLive')}</Text>
            <TouchableOpacity
              style={styles.trackButton}
              onPress={() => router.push(`/delivery/${order.id}`)}
            >
              <Ionicons name="map-outline" size={20} color={theme.iconColors.white} />
              <Text style={styles.trackButtonText}>{t('openLiveMap')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Proof of Delivery - For Carriers */}
        {canSubmitProof && (
          <View style={styles.section}>
            <View style={styles.proofHeader}>
              <Ionicons name="camera-outline" size={24} color={theme.iconColors.primary} />
              <Text style={styles.proofTitle}>{t('proofOfDelivery')}</Text>
            </View>
            <Text style={styles.proofDescription}>{t('proofOfDeliveryDescription')}</Text>

            {/* Delivery Photos */}
            <View style={styles.photosSection}>
              <Text style={styles.subsectionTitle}>
                {t('deliveryPhotos')} ({deliveryPhotos.length})
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photosScroll}
              >
                {deliveryPhotos.map((photo, index) => (
                  <View key={index} style={styles.photoContainer}>
                    <LazyImage
                      uri={photo}
                      style={styles.photoPreview}
                      containerStyle={styles.photoPreview}
                      resizeMode="cover"
                      placeholderIcon="image-outline"
                      placeholderSize={32}
                      showErrorText={false}
                    />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => removePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={24} color={theme.iconColors.error} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={styles.addPhotoButton} onPress={addPhoto}>
                  <Ionicons name="camera-outline" size={32} color={theme.iconColors.gray.primary} />
                  <Text style={styles.addPhotoText}>{t('addPhoto')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Digital Signature */}
            <View style={styles.signatureSection}>
              <Text style={styles.subsectionTitle}>{t('customerSignature')}</Text>

              {signature ? (
                <View style={styles.signaturePreviewContainer}>
                  {signatureError ? (
                    <View style={[styles.signaturePreview, styles.signatureError]}>
                      <Ionicons
                        name="document-outline"
                        size={48}
                        color={theme.iconColors.gray.secondary}
                      />
                      <Text style={styles.signatureErrorText}>{t('signatureUnavailable')}</Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: signature }}
                      style={styles.signaturePreview}
                      resizeMode="contain"
                      onError={error => {
                        console.error('Signature load error:', error.nativeEvent.error);
                        setSignatureError(true);
                      }}
                    />
                  )}
                  <TouchableOpacity style={styles.retakeSignatureButton} onPress={captureSignature}>
                    <Ionicons name="refresh-outline" size={20} color={theme.iconColors.primary} />
                    <Text style={styles.retakeSignatureText}>{t('retake')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.captureSignatureButton} onPress={captureSignature}>
                  <Ionicons name="create-outline" size={24} color={theme.iconColors.white} />
                  <Text style={styles.captureSignatureText}>{t('captureSignature')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitProofButton,
                (uploadingProof || deliveryPhotos.length === 0 || !signature) &&
                styles.submitProofButtonDisabled,
              ]}
              onPress={submitDeliveryProof}
              disabled={uploadingProof || deliveryPhotos.length === 0 || !signature}
            >
              {uploadingProof ? (
                <ActivityIndicator size="small" color={theme.iconColors.white} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-done-outline"
                    size={20}
                    color={theme.iconColors.white}
                  />
                  <Text style={styles.submitProofButtonText}>{t('submitDeliveryProof')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery Confirmation */}
        {canConfirmDelivery && (
          <View style={styles.section}>
            <View style={styles.confirmationHeader}>
              <Ionicons
                name="checkmark-circle-outline"
                size={24}
                color={theme.iconColors.success}
              />
              <Text style={styles.confirmationTitle}>{t('confirmDelivery')}</Text>
            </View>
            <Text style={styles.confirmationDescription}>{t('confirmDeliveryDescription')}</Text>
            <TouchableOpacity
              style={[styles.confirmButton, confirming && styles.confirmButtonDisabled]}
              onPress={confirmDelivery}
              disabled={confirming}
            >
              {confirming ? (
                <ActivityIndicator size="small" color={theme.iconColors.white} />
              ) : (
                <Text style={styles.confirmButtonText}>{t('confirmDelivery')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* View Delivery Proof (for both parties after delivered) */}
        {order?.status === 'delivered' && order.delivery_photos && order.delivery_signature && (
          <View style={styles.section}>
            <View style={styles.proofHeader}>
              <Ionicons name="checkmark-circle" size={24} color={theme.iconColors.success} />
              <Text style={styles.proofTitle}>{t('deliveryProof')}</Text>
            </View>

            {/* Delivery Photos */}
            <View style={styles.photosSection}>
              <Text style={styles.subsectionTitle}>
                {t('deliveryPhotos')} ({order.delivery_photos.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photosScroll}
              >
                {order.delivery_photos.map((photo, index) => (
                  <Image key={index} source={{ uri: photo }} style={styles.photoPreview} />
                ))}
              </ScrollView>
            </View>

            {/* Signature */}
            <View style={styles.signatureSection}>
              <Text style={styles.subsectionTitle}>{t('customerSignature')}</Text>
              <Image
                source={{ uri: order.delivery_signature }}
                style={styles.signaturePreview}
                resizeMode="contain"
              />
            </View>

            {deliveryTime && (
              <View style={styles.deliveryTimeInfo}>
                <Ionicons name="time-outline" size={16} color={theme.iconColors.gray.primary} />
                <Text style={styles.deliveryTimeText}>
                  {t('deliveredAt')}: {formatDateTime(deliveryTime)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* File Dispute */}
        {canFileDispute && (
          <View style={styles.section}>
            <View style={[styles.confirmationHeader]}>
              <Ionicons name="flag-outline" size={24} color={colors.status.error} />
              <Text style={[styles.confirmationTitle, { color: colors.status.error }]}>
                {t('disputeSection')}
              </Text>
            </View>
            <Text style={styles.confirmationDescription}>{t('disputeSectionDescription')}</Text>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: colors.status.error }]}
              onPress={() =>
                router.push({
                  pathname: '/dispute/[orderId]',
                  params: { orderId: orderId as string },
                })
              }
            >
              <Text style={styles.confirmButtonText}>{t('fileDispute')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Signature Pad Modal */}
      <SignaturePad
        visible={signatureModalVisible}
        onClose={() => setSignatureModalVisible(false)}
        onSave={saveSignature}
        title={t('customerSignature')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.error,
  },
  missingOrderDetailsText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  liveStatusRow: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(230,230,230,0.5)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  statusSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xxxs,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  orderTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  routeContainer: {
    paddingLeft: spacing.sm,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  routeText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  routeArrow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  participantCard: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  participantRole: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    textTransform: 'uppercase',
    fontWeight: fontWeight.semibold,
  },
  participantName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  participantPhone: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xxs,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  paymentLabel: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  paymentAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  paymentStatus: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textTransform: 'capitalize',
  },
  escrowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: '#F0FDF4',
    borderRadius: borderRadius.sm,
  },
  escrowText: {
    fontSize: fontSize.sm,
    color: colors.success,
    marginLeft: spacing.sm,
    fontWeight: fontWeight.semibold,
  },
  confirmationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  confirmationTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.success,
    marginLeft: spacing.sm,
  },
  confirmationDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  confirmButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  trackButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 4,
  },
  liveText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#2E7D32',
    textTransform: 'uppercase',
  },
  proofHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  proofTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  proofDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  photosSection: {
    marginBottom: spacing.xl,
  },
  subsectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  photosScroll: {
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  photoContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  photoPreview: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.md,
  } as ImageStyle,
  photoError: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  photoErrorText: {
    marginTop: spacing.xxxs,
    fontSize: fontSize.xs,
    color: theme.iconColors.gray.secondary,
    textAlign: 'center',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
  },
  addPhotoButton: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
  },
  addPhotoText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  signatureSection: {
    marginBottom: spacing.xl,
  },
  signaturePreviewContainer: {
    position: 'relative',
  },
  signaturePreview: {
    width: '100%',
    height: 150,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
  } as ImageStyle,
  signatureError: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  signatureErrorText: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: theme.iconColors.gray.secondary,
    textAlign: 'center',
  },
  retakeSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  retakeSignatureText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginLeft: spacing.xs,
    fontWeight: fontWeight.semibold,
  },
  captureSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  captureSignatureText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  submitProofButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  submitProofButtonDisabled: {
    opacity: 0.5,
  },
  submitProofButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  deliveryTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  deliveryTimeText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
});
