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
import { supabase } from '../../lib/supabase';
import { trackPaymentInitiated, trackPaymentCompleted } from '../../utils/analytics';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenSection } from '../../components/ScreenSection';
import { SkeletonLoader } from '../../components/SkeletonLoader';
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

type EscrowPayment = {
  id: string;
  status?: string;
  payment_url?: string;
  provider_order_id?: string;
};

type EscrowPaymentRecord = {
  order_id: string;
  customer_id: string;
  carrier_id: string;
  total_amount: number;
  platform_fee: number;
  carrier_amount: number;
  status: string;
  idempotency_key: string;
  created_at: string;
  request_id?: string;
  bid_id?: string;
};

type NormalizedAmounts = {
  total_amount: number;
  platform_fee: number;
  carrier_amount: number;
  wasLegacy: boolean;
};

const normalizeOrderAmounts = (
  totalAmountRaw: number,
  platformFeeRaw: number,
  carrierAmountRaw: number
): NormalizedAmounts => {
  const totalAmount = Number(totalAmountRaw || 0);
  const platformFee = Number(platformFeeRaw || 0);
  const carrierAmount = Number(carrierAmountRaw || 0);

  const expectedLegacyPlatformFee = Math.round(totalAmount * 0.1);
  const expectedLegacyCarrierAmount = totalAmount - platformFee;

  const looksLegacyModel =
    totalAmount > 0 &&
    platformFee >= 0 &&
    carrierAmount >= 0 &&
    Math.abs(platformFee - expectedLegacyPlatformFee) <= 1 &&
    Math.abs(carrierAmount - expectedLegacyCarrierAmount) <= 1;

  if (!looksLegacyModel) {
    return {
      total_amount: totalAmount,
      platform_fee: platformFee,
      carrier_amount: carrierAmount,
      wasLegacy: false,
    };
  }

  const normalizedCarrierAmount = totalAmount;
  const normalizedPlatformFee = Math.round(normalizedCarrierAmount * 0.1);
  const normalizedTotalAmount = normalizedCarrierAmount + normalizedPlatformFee;

  return {
    total_amount: normalizedTotalAmount,
    platform_fee: normalizedPlatformFee,
    carrier_amount: normalizedCarrierAmount,
    wasLegacy: true,
  };
};

export default function PaymentScreen() {
  const { orderId } = useLocalSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, authLoading, router]);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const vippsFunctionName = (process.env.EXPO_PUBLIC_VIPPS_FUNCTION_NAME || 'vipps-payment').trim();
  const language = i18n?.language || 'en';
  const locale = language.startsWith('no') ? 'nb-NO' : 'en-US';

  const formatNokAmount = (value: number) => {
    const formatted = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
    return `${formatted} kr`;
  };

  const updateOrderPaymentStatus = async (status: string) => {
    if (!order?.id) {
      return;
    }

    const { error } = await supabase
      .from('orders')
      .update({ payment_status: status, updated_at: new Date().toISOString() })
      .eq('id', order.id);

    if (error) {
      console.warn(`Failed to update order payment_status to ${status}:`, error);
    }
  };

  const updateEscrowStatus = async (escrowId: string, status: string) => {
    const { error } = await supabase.from('escrow_payments').update({ status }).eq('id', escrowId);
    if (error) {
      console.warn(`Failed to update escrow status to ${status}:`, error);
    }
  };

  const extractVippsErrorMessage = async (error: unknown): Promise<string> => {
    if (error instanceof Error && error.name !== 'FunctionsHttpError') {
      return error.message;
    }

    const maybeFunctionError = error as {
      name?: string;
      message?: string;
      context?: {
        status?: number;
        statusText?: string;
        json?: () => Promise<unknown>;
        text?: () => Promise<string>;
      };
    };

    const responseContext = maybeFunctionError?.context;
    if (!responseContext) {
      return maybeFunctionError?.message || t('error');
    }

    let serverMessage = '';
    try {
      if (typeof responseContext.json === 'function') {
        const body = await responseContext.json();
        if (body && typeof body === 'object') {
          const messageValue = (body as Record<string, unknown>).message;
          const errorValue = (body as Record<string, unknown>).error;
          if (typeof messageValue === 'string') {
            serverMessage = messageValue;
          } else if (typeof errorValue === 'string') {
            serverMessage = errorValue;
          }
        }
      }
    } catch {
      try {
        if (typeof responseContext.text === 'function') {
          serverMessage = await responseContext.text();
        }
      } catch {
        serverMessage = '';
      }
    }

    const statusCode = responseContext.status ? `HTTP ${responseContext.status}` : 'HTTP error';
    const statusText = responseContext.statusText || 'Edge Function failed';
    const suffix = serverMessage ? `: ${serverMessage}` : '';
    return `${statusCode} ${statusText}${suffix}`.trim();
  };

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
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .select(
          'id, total_amount, platform_fee, carrier_amount, status, carrier_id, customer_id, request_id, bid_id'
        )
        .eq('id', orderId)
        .single();

      if (orderError || !orderRow) {
        throw new Error('Order not found');
      }

      const orderData: Order = {
        id: orderRow.id,
        total_amount: Number(orderRow.total_amount || 0),
        platform_fee: Number(orderRow.platform_fee || 0),
        carrier_amount: Number(orderRow.carrier_amount || 0),
        status: orderRow.status || 'pending',
        carrier_id: orderRow.carrier_id,
        customer_id: orderRow.customer_id,
        request_id: orderRow.request_id || undefined,
        bid_id: orderRow.bid_id || undefined,
        cargo_requests: {
          title: '',
          from_address: '',
          to_address: '',
        },
        carrier: {
          full_name: '',
          phone: '',
        },
      };

      const normalizedAmounts = normalizeOrderAmounts(
        Number(orderRow.total_amount || 0),
        Number(orderRow.platform_fee || 0),
        Number(orderRow.carrier_amount || 0)
      );

      orderData.total_amount = normalizedAmounts.total_amount;
      orderData.platform_fee = normalizedAmounts.platform_fee;
      orderData.carrier_amount = normalizedAmounts.carrier_amount;

      if (normalizedAmounts.wasLegacy) {
        const { error: normalizeOrderError } = await supabase
          .from('orders')
          .update({
            total_amount: normalizedAmounts.total_amount,
            platform_fee: normalizedAmounts.platform_fee,
            carrier_amount: normalizedAmounts.carrier_amount,
          })
          .eq('id', orderRow.id);

        if (normalizeOrderError) {
          console.warn('Failed to normalize legacy order amounts:', normalizeOrderError);
        }
      }

      // Fetch cargo request
      if (orderData.request_id) {
        const { data: requestRow } = await supabase
          .from('cargo_requests')
          .select('title, from_address, to_address')
          .eq('id', orderData.request_id)
          .maybeSingle();

        if (requestRow) {
          orderData.cargo_requests = {
            title: requestRow.title || '',
            from_address: requestRow.from_address || '',
            to_address: requestRow.to_address || '',
          };
        }
      }

      // Fetch carrier user data
      if (orderData.carrier_id) {
        const { data: carrierRow } = await supabase
          .from('profiles')
          .select('full_name, phone, avatar_url')
          .eq('id', orderData.carrier_id)
          .maybeSingle();

        if (carrierRow) {
          orderData.carrier = {
            full_name: carrierRow.full_name || '',
            phone: carrierRow.phone || '',
            avatar_url: carrierRow.avatar_url || undefined,
          };
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

    let createdEscrowPaymentId: string | null = null;
    setProcessing(true);
    try {
      // 🔐 Generate idempotency key to prevent duplicate payments
      const idempotencyKey = `payment_${order.id}_${Date.now()}`;

      // 🔍 Check if payment already exists for this order
      const { data: existingPayments, error: existingPaymentsError } = await supabase
        .from('escrow_payments')
        .select('id, status, payment_url, provider_order_id')
        .eq('order_id', order.id)
        .in('status', ['initiated', 'paid'])
        .limit(1);

      if (existingPaymentsError) {
        throw existingPaymentsError;
      }

      if (existingPayments && existingPayments.length > 0) {
        const existingPayment = existingPayments[0] as EscrowPayment;
        const existingPaymentId = existingPayment.id;

        // If payment is already initiated with a Vipps URL, offer to continue
        if (existingPayment.payment_url) {
          Alert.alert(t('paymentInProgress'), t('paymentAlreadyInitiated'), [
            {
              text: t('continue'),
              onPress: () => {
                // In production, open the existing Vipps URL
                // Linking.openURL(existingPayment.payment_url);
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
        // Mark stale initiated payment as failed before creating a new one
        const { error: stalePaymentUpdateError } = await supabase
          .from('escrow_payments')
          .update({ status: 'failed' })
          .eq('id', existingPaymentId);

        if (stalePaymentUpdateError) {
          console.warn('Failed to mark stale payment as failed:', stalePaymentUpdateError);
        } else {
          console.warn('Existing payment without Vipps URL marked as failed:', existingPaymentId);
        }
      }

      // Validate all required data before making the request
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      // Get phone number from user profile
      const { data: userRow, error: userError } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.uid)
        .single();

      if (userError || !userRow?.phone) {
        throw new Error(t('vippsPhoneRequired'));
      }

      const customerPhone = userRow.phone;

      // Validate order data
      if (!order.carrier_id) {
        throw new Error('Order data is incomplete - missing carrier information');
      }

      // Create escrow payment record with idempotency key
      const escrowData: EscrowPaymentRecord = {
        order_id: order.id,
        customer_id: user.uid,
        carrier_id: order.carrier_id,
        total_amount: order.total_amount,
        platform_fee: order.platform_fee,
        carrier_amount: order.carrier_amount,
        status: 'initiated',
        idempotency_key: idempotencyKey,
        created_at: new Date().toISOString(),
      };

      // Add optional fields if they exist
      if (order.request_id) {
        escrowData.request_id = order.request_id;
      }
      if (order.bid_id) {
        escrowData.bid_id = order.bid_id;
      }

      const { data: insertedEscrowPayment, error: escrowInsertError } = await supabase
        .from('escrow_payments')
        .insert(escrowData)
        .select('id')
        .single();

      if (escrowInsertError || !insertedEscrowPayment) {
        throw escrowInsertError || new Error('Failed to create escrow payment');
      }

      createdEscrowPaymentId = insertedEscrowPayment.id;
      await updateOrderPaymentStatus('initiated');

      // Track payment initiated
      trackPaymentInitiated({
        order_id: order.id,
        amount: order.total_amount,
        method: 'vipps',
        payment_provider: 'vipps',
      });

      const { data: result, error: functionError } = await supabase.functions.invoke(
        vippsFunctionName,
        {
          body: {
            escrow_payment_id: insertedEscrowPayment.id,
            amount: order.total_amount,
            order_id: order.id,
            customer_phone: customerPhone,
            description: `${t('payment')} - ${order.cargo_requests.title}`,
            customer_name: user?.displayName || user?.email || 'Customer',
            carrier_name: order.carrier.full_name,
          },
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      if (functionError) {
        throw functionError;
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      // Redirect to Vipps
      if (result?.vipps_url || result?.payment_url) {
        const paymentUrl = result?.vipps_url || result?.payment_url;
        const providerOrderId =
          typeof result?.provider_order_id === 'string' ? result.provider_order_id : null;

        await supabase
          .from('escrow_payments')
          .update({ payment_url: paymentUrl, provider_order_id: providerOrderId || undefined })
          .eq('id', insertedEscrowPayment.id);

        Alert.alert(t('vippsPayment'), t('vippsRedirectMessage'), [
          {
            text: t('continue'),
            onPress: () => {
              // Here you would typically use Linking.openURL(paymentUrl)
              // For now, we'll simulate the payment process
              simulatePaymentSuccess();
            },
          },
          {
            text: t('cancel'),
            style: 'cancel',
          },
        ]);
      } else {
        throw new Error(t('paymentInitiationMissingUrl'));
      }
    } catch (error: unknown) {
      const message = await extractVippsErrorMessage(error);
      console.warn('Vipps payment handled error:', message);

      const isFunctionsHttpError =
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error as { name?: string }).name === 'FunctionsHttpError';

      const isFunctionNotFound =
        message.includes('HTTP 404') ||
        message.toLowerCase().includes('requested function was not found');

      if (createdEscrowPaymentId && isFunctionsHttpError) {
        await updateEscrowStatus(createdEscrowPaymentId, 'failed');
        await updateOrderPaymentStatus('failed');
      }

      if (isFunctionNotFound) {
        if (__DEV__) {
          Alert.alert(t('vippsPayment'), t('vippsFunctionNotDeployedDev'), [
            {
              text: t('continue'),
              onPress: () => {
                simulatePaymentSuccess();
              },
            },
            {
              text: t('cancel'),
              style: 'cancel',
            },
          ]);
          return;
        }

        Alert.alert(t('error'), t('vippsFunctionNotAvailable'));
        return;
      }

      if (__DEV__ && isFunctionsHttpError) {
        Alert.alert(t('error'), message, [
          {
            text: t('continue'),
            onPress: () => {
              simulatePaymentSuccess();
            },
          },
          {
            text: t('cancel'),
            style: 'cancel',
          },
        ]);
      } else {
        Alert.alert(t('error'), message || t('error'));
      }
    } finally {
      setProcessing(false);
    }
  };

  const simulatePaymentSuccess = () => {
    // This simulates a successful payment return from Vipps
    setTimeout(async () => {
      if (order) {
        const { data: latestEscrow } = await supabase
          .from('escrow_payments')
          .select('id')
          .eq('order_id', order.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestEscrow?.id) {
          await updateEscrowStatus(latestEscrow.id, 'paid');
        }

      await updateOrderPaymentStatus('paid');

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
        <ScreenHeader title={t('payment')} onBackPress={() => router.back()} />
        <ScrollView contentContainerStyle={styles.skeletonContent}>
          <SkeletonLoader variant="stats" count={1} />
          <SkeletonLoader variant="text" count={2} />
          <SkeletonLoader variant="card" count={1} />
        </ScrollView>
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t('payment')} showBackButton />

      <ScrollView style={styles.scrollView}>
        {/* 1. Vipps Payment Button - MOVED TO TOP */}
        <ScreenSection>
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
        </ScreenSection>

        {/* 2. Payment Breakdown */}
        <ScreenSection title={t('paymentBreakdown')}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>{t('carrierPayment')}:</Text>
            <Text style={styles.paymentAmount}>{formatNokAmount(order.carrier_amount)}</Text>
          </View>

          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>{t('platformFee')}:</Text>
            <Text style={styles.paymentAmount}>{formatNokAmount(order.platform_fee)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.paymentRow}>
            <Text style={styles.totalLabel}>{t('totalAmount')}:</Text>
            <Text style={styles.totalAmount}>{formatNokAmount(order.total_amount)}</Text>
          </View>
        </ScreenSection>

        {/* 3. Escrow Information (Security) */}
        <ScreenSection>
          <View style={styles.escrowHeader}>
            <Ionicons name="shield-checkmark" size={24} color={theme.iconColors.success} />
            <Text style={styles.escrowTitle}>{t('secureEscrowPayment')}</Text>
          </View>
          <Text style={styles.escrowDescription}>{t('escrowDescription')}</Text>
        </ScreenSection>
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
    padding: spacing.xxxl,
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
    marginBottom: spacing.xxs,
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
