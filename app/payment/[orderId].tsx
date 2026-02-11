import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { db, firebaseProjectId, firebaseApiKey } from '../../lib/firebase';
import { trackPaymentInitiated, trackPaymentCompleted } from '../../utils/analytics';
import { fetchWithRetry } from '../../utils/fetchWithTimeout';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  setDoc,
} from 'firebase/firestore';
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
  total_amount: number;
  platform_fee: number;
  carrier_amount: number;
  status: string;
  carrier_id: string;
  customer_id: string;
  request_id?: string;
  bid_id?: string;
  cargo_requests: {
    title: string;
    from_address: string;
    to_address: string;
  };
  carrier: {
    full_name: string;
    phone: string;
    avatar_url?: string;
  };
}

export default function PaymentScreen() {
  const { orderId } = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrder = async () => {
    try {
      if (!orderId || typeof orderId !== 'string') {
        throw new Error('Invalid order ID');
      }

      // Fetch order
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        throw new Error('Order not found');
      }

      const orderData = { id: orderSnap.id, ...orderSnap.data() } as any;

      // Fetch cargo request
      if (orderData.request_id) {
        const requestRef = doc(db, 'cargo_requests', orderData.request_id);
        const requestSnap = await getDoc(requestRef);
        if (requestSnap.exists()) {
          orderData.cargo_requests = requestSnap.data();
        }
      }

      // Fetch carrier user data
      if (orderData.carrier_id) {
        const carrierRef = doc(db, 'users', orderData.carrier_id);
        const carrierSnap = await getDoc(carrierRef);
        if (carrierSnap.exists()) {
          orderData.carrier = carrierSnap.data();
        }
      }

      setOrder(orderData);
    } catch (error) {
      console.error('Error fetching order:', error);
      Alert.alert(
        t('error'),
        error instanceof Error ? error.message : 'Failed to load order details'
      );
    } finally {
      setLoading(false);
    }
  };

  const initiateVippsPayment = async () => {
    if (!order) return;

    setProcessing(true);
    try {
      // 🔐 Generate idempotency key to prevent duplicate payments
      const idempotencyKey = `payment_${order.id}_${Date.now()}`;

      // 🔍 Check if payment already exists for this order
      const existingPaymentQuery = query(
        collection(db, 'escrow_payments'),
        where('order_id', '==', order.id),
        where('status', 'in', ['initiated', 'paid'])
      );
      const existingPaymentSnap = await getDocs(existingPaymentQuery);

      if (!existingPaymentSnap.empty) {
        const existingPayment = existingPaymentSnap.docs[0].data();
        const existingPaymentId = existingPaymentSnap.docs[0].id;

        // If payment is already initiated with a Vipps URL, offer to continue
        if (existingPayment.vipps_url) {
          Alert.alert(t('paymentInProgress'), t('paymentAlreadyInitiated'), [
            {
              text: t('continue'),
              onPress: () => {
                // In production, open the existing Vipps URL
                // Linking.openURL(existingPayment.vipps_url);
                simulatePaymentSuccess();
              },
            },
            {
              text: t('cancel'),
              style: 'cancel',
            },
          ]);
          setProcessing(false);
          return;
        }

        // If payment exists but no Vipps URL, it might be stuck
        // Log this for debugging
        console.warn('Existing payment without Vipps URL:', existingPaymentId);
      }

      // Validate Firebase configuration
      if (!firebaseProjectId || !firebaseApiKey) {
        throw new Error(
          'Firebase configuration is incomplete. Please check your environment variables.'
        );
      }

      // Validate all required data before making the request
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      // Get phone number from user profile
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists() || !userSnap.data()?.phone) {
        throw new Error(
          'User phone number is required for Vipps payment. Please update your profile.'
        );
      }

      const customerPhone = userSnap.data()?.phone;

      // Validate order data
      if (!order.carrier_id) {
        throw new Error('Order data is incomplete - missing carrier information');
      }

      // Create escrow payment record with idempotency key
      const escrowRef = doc(collection(db, 'escrow_payments'));
      const escrowData: any = {
        id: escrowRef.id,
        order_id: order.id,
        customer_id: user?.uid,
        carrier_id: order.carrier_id,
        total_amount: order.total_amount,
        platform_fee: order.platform_fee,
        carrier_amount: order.carrier_amount,
        status: 'initiated',
        idempotency_key: idempotencyKey,
        created_at: serverTimestamp(),
      };

      // Add optional fields if they exist
      if (order.request_id) {
        escrowData.request_id = order.request_id;
      }
      if (order.bid_id) {
        escrowData.bid_id = order.bid_id;
      }

      await setDoc(escrowRef, escrowData);
      const escrowPayment = { id: escrowRef.id, ...escrowData };

      // Track payment initiated
      trackPaymentInitiated({
        order_id: order.id,
        amount: order.total_amount,
        method: 'vipps',
        payment_provider: 'vipps',
      });

      // Call Vipps API through Firebase Cloud Function with idempotency key
      const cloudFunctionUrl = `https://europe-west1-${firebaseProjectId}.cloudfunctions.net/vipps-payment`;
      console.log('Calling Cloud Function:', cloudFunctionUrl);

      const response = await fetchWithRetry(cloudFunctionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${firebaseApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey, // 🔑 Critical for preventing duplicate charges
        },
        body: JSON.stringify({
          escrow_payment_id: escrowPayment.id,
          amount: order.total_amount,
          order_id: order.id,
          customer_phone: customerPhone,
          description: `${t('payment')} - ${order.cargo_requests.title}`,
          customer_name: user?.displayName || user?.email || 'Customer',
          carrier_name: order.carrier.full_name,
        }),
        timeout: 30000, // 30 seconds for payment operations
        retries: 2, // Retry up to 2 times
        onRetry: (attempt, error) => {
          console.log(`Payment request retry attempt ${attempt}:`, error.message);
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Payment initiation failed');
      }

      // Redirect to Vipps
      if (result.vipps_url) {
        // In a real app, you would open this URL in the Vipps app or browser
        Alert.alert(t('vippsPayment'), t('vippsRedirectMessage'), [
          {
            text: t('continue'),
            onPress: () => {
              // Here you would typically use Linking.openURL(result.vipps_url)
              // For now, we'll simulate the payment process
              simulatePaymentSuccess();
            },
          },
          {
            text: t('cancel'),
            style: 'cancel',
          },
        ]);
      }
    } catch (error: any) {
      console.error('Vipps payment error:', error);
      Alert.alert(t('error'), error.message);
    } finally {
      setProcessing(false);
    }
  };

  const simulatePaymentSuccess = () => {
    // This simulates a successful payment return from Vipps
    setTimeout(() => {
      if (order) {
        // Track payment completed
        trackPaymentCompleted({
          order_id: order.id,
          amount: order.total_amount,
          method: 'vipps',
          payment_provider: 'vipps',
        });
      }

      Alert.alert(t('paymentSuccessful'), t('paymentSuccessMessage'), [
        {
          text: t('ok'),
          onPress: () => router.replace(`/order-status/${orderId}`),
        },
      ]);
    }, 2000);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.iconColors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.iconColors.error} />
          <Text style={styles.errorText}>{t('orderNotFound')}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t('goBack')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.iconColors.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* 1. Vipps Payment Button - MOVED TO TOP */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.vippsButton, processing && styles.vippsButtonDisabled]}
            onPress={initiateVippsPayment}
            disabled={processing}
          >
            <View style={styles.vippsContent}>
              <View style={styles.vippsLogo}>
                <Text style={styles.vippsLogoText}>Vipps</Text>
              </View>
              <Text style={styles.vippsButtonText}>
                {processing ? t('processing') : t('payWithVipps')}
              </Text>
              {processing && (
                <ActivityIndicator
                  size="small"
                  color={theme.iconColors.white}
                  style={styles.vippsSpinner}
                />
              )}
            </View>
          </TouchableOpacity>

          <Text style={styles.paymentNote}>{t('paymentNote')}</Text>
        </View>

        {/* 2. Payment Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('paymentBreakdown')}</Text>

          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>{t('carrierPayment')}:</Text>
            <Text style={styles.paymentAmount}>{order.carrier_amount} NOK</Text>
          </View>

          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>{t('platformFee')}:</Text>
            <Text style={styles.paymentAmount}>{order.platform_fee} NOK</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.paymentRow}>
            <Text style={styles.totalLabel}>{t('totalAmount')}:</Text>
            <Text style={styles.totalAmount}>{order.total_amount} NOK</Text>
          </View>
        </View>

        {/* 3. Escrow Information (Security) */}
        <View style={styles.section}>
          <View style={styles.escrowHeader}>
            <Ionicons name="shield-checkmark" size={24} color={theme.iconColors.success} />
            <Text style={styles.escrowTitle}>{t('secureEscrowPayment')}</Text>
          </View>
          <Text style={styles.escrowDescription}>{t('escrowDescription')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.error,
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
  },
  backButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  orderTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  routeContainer: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  routePointBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: spacing.sm,
  },
  locationTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  locationLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  routeArrow: {
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  carrierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  carrierLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  carrierDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  carrierAvatar: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
  },
  carrierAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carrierName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
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
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.md,
  },
  totalLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  totalAmount: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  escrowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  escrowTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.status.success,
    marginLeft: spacing.sm,
  },
  escrowDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  vippsButton: {
    backgroundColor: '#FF5B24',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#FF5B24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  vippsButtonDisabled: {
    opacity: 0.6,
  },
  vippsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vippsLogo: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  vippsLogoText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#FF5B24',
  },
  vippsButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  vippsSpinner: {
    marginLeft: spacing.md,
  },
  paymentNote: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
