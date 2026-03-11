import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { triggerHapticFeedback } from '../../utils/haptics';
import { normalizeCargoImageInputs, resolveCargoImageUrls } from '../../utils/cargoImages';
import { SuccessAnimation } from '../../components/SuccessAnimation';
import { LazyImage } from '../../components/LazyImage';
import Avatar from '../../components/Avatar';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  trackBidSubmitted,
  trackBidAccepted,
  trackCargoRequestDeleted,
} from '../../utils/analytics';
import { colors, spacing, fontSize, borderRadius } from '../../lib/sharedStyles';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { TOUCH_TARGET } from '../../constants/touchTargets';
import { acceptBid as acceptBidEdgeFn } from '../../hooks/useBids';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CargoRequest {
  id: string;
  title: string;
  description: string;
  cargo_type: string;
  weight: number;
  dimensions?: string;
  from_address: string;
  to_address: string;
  from_lat?: number | string | null;
  from_lng?: number | string | null;
  to_lat?: number | string | null;
  to_lng?: number | string | null;
  distance_km?: number;
  pickup_date: string;
  delivery_date: string;
  price: number;
  price_type: string;
  status: string;
  user_id: string;
  customer_id?: string;
  weight_kg?: number;
  automotive_meta?: AutomotiveMeta;
  images?: string[];
  users?: {
    full_name: string;
    user_type: string;
    rating: number;
    phone: string;
    avatar_url?: string;
  };
}

interface Bid {
  id: string;
  price: number;
  message: string;
  status: string;
  created_at: unknown;
  carrier_id: string;
  users?: {
    full_name: string;
    user_type: string;
    rating: number;
    phone: string;
    avatar_url?: string;
    completed_transports?: number;
    on_time_rate?: number | null;
    review_count?: number;
  };
}

type AutomotiveCondition = {
  isDriveable: boolean | null;
  starts: boolean | null;
  hasDamage: boolean | null;
};

type AutomotiveMeta = {
  driveable?: unknown;
  starts?: unknown;
  damage?: unknown;
  vin?: unknown;
  has_keys?: unknown;
  wheel_lock?: unknown;
  ground_clearance_cm?: unknown;
  needs_winch?: unknown;
  transport_type?: unknown;
} | null;

type AutomotiveMetaDetails = {
  vin?: string;
  hasKeys?: boolean;
  hasWheelLock?: boolean;
  groundClearanceCm?: number;
  needsWinch?: boolean;
  transportType?: 'open' | 'enclosed';
};

const parseBooleanToken = (value: string): boolean | null => {
  const normalized = value.trim().toLowerCase();
  if (['yes', 'ja', 'true', '1'].includes(normalized)) return true;
  if (['no', 'nei', 'false', '0'].includes(normalized)) return false;
  return null;
};

const parseAutomotiveMeta = (value: AutomotiveMeta): AutomotiveCondition | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const readBoolean = (input: unknown): boolean | null => {
    if (typeof input === 'boolean') {
      return input;
    }

    if (typeof input === 'string') {
      return parseBooleanToken(input);
    }

    if (typeof input === 'number') {
      if (input === 1) return true;
      if (input === 0) return false;
    }

    return null;
  };

  const meta = value as { driveable?: unknown; starts?: unknown; damage?: unknown };
  const parsed: AutomotiveCondition = {
    isDriveable: readBoolean(meta.driveable),
    starts: readBoolean(meta.starts),
    hasDamage: readBoolean(meta.damage),
  };

  const hasAnyCondition =
    parsed.isDriveable !== null || parsed.starts !== null || parsed.hasDamage !== null;

  return hasAnyCondition ? parsed : null;
};

const parseAutomotiveMetaDetails = (value: AutomotiveMeta): AutomotiveMetaDetails | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const meta = value as {
    vin?: unknown;
    has_keys?: unknown;
    wheel_lock?: unknown;
    ground_clearance_cm?: unknown;
    needs_winch?: unknown;
    transport_type?: unknown;
  };

  const readBoolean = (input: unknown): boolean | undefined => {
    if (typeof input === 'boolean') {
      return input;
    }
    if (typeof input === 'string') {
      const parsed = parseBooleanToken(input);
      return parsed === null ? undefined : parsed;
    }
    if (typeof input === 'number') {
      if (input === 1) return true;
      if (input === 0) return false;
    }
    return undefined;
  };

  const clearanceRaw = meta.ground_clearance_cm;
  const clearance =
    typeof clearanceRaw === 'number'
      ? clearanceRaw
      : typeof clearanceRaw === 'string'
        ? Number(clearanceRaw)
        : NaN;

  const parsed: AutomotiveMetaDetails = {
    vin: typeof meta.vin === 'string' && meta.vin.trim().length > 0 ? meta.vin.trim() : undefined,
    hasKeys: readBoolean(meta.has_keys),
    hasWheelLock: readBoolean(meta.wheel_lock),
    groundClearanceCm: Number.isFinite(clearance) ? clearance : undefined,
    needsWinch: readBoolean(meta.needs_winch),
    transportType: meta.transport_type === 'enclosed' ? 'enclosed' : meta.transport_type === 'open' ? 'open' : undefined,
  };

  const hasAnyValue = Object.values(parsed).some(value => value !== undefined);
  return hasAnyValue ? parsed : null;
};

const parseAutomotiveDescription = (description: string | null | undefined) => {
  if (!description) {
    return {
      cleanDescription: '',
      condition: null as AutomotiveCondition | null,
    };
  }

  let cleaned = description;
  const condition: AutomotiveCondition = {
    isDriveable: null,
    starts: null,
    hasDamage: null,
  };

  const machineTagMatch = cleaned.match(/^\[automotive_condition\|([^\]]+)\]\s*/i);
  if (machineTagMatch) {
    const pairs = machineTagMatch[1].split('|');
    for (const pair of pairs) {
      const [rawKey, rawValue] = pair.split('=');
      const key = (rawKey || '').trim().toLowerCase();
      const value = parseBooleanToken(rawValue || '');

      if (key === 'driveable') {
        condition.isDriveable = value;
      } else if (key === 'starts') {
        condition.starts = value;
      } else if (key === 'damage') {
        condition.hasDamage = value;
      }
    }

    cleaned = cleaned.slice(machineTagMatch[0].length);
  }

  const humanTagMatch = cleaned.match(/^\[([\s\S]*?)\]\s*/);
  if (humanTagMatch) {
    const block = humanTagMatch[1];
    const lowerBlock = block.toLowerCase();
    const likelyAutomotiveBlock =
      /driveable|non.?driveable|kjørbar|kan rulles|vinsj|starter|starts|skader|damage/.test(
        lowerBlock
      );

    if (likelyAutomotiveBlock) {
      const lines = block
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        const [rawLabel, rawValue] = line.includes(':')
          ? line.split(/:(.+)/).slice(0, 2)
          : [line, ''];
        const label = (rawLabel || '').toLowerCase();
        const value = parseBooleanToken(rawValue || '');

        if (
          condition.isDriveable === null &&
          /(driveable|kjørbar|rulles|non.?driveable|vinsj)/.test(label)
        ) {
          if (value !== null) {
            condition.isDriveable = value;
          } else if (/ikke|non|vinsj/.test(label)) {
            condition.isDriveable = false;
          } else if (/kjørbar|rulles|driveable/.test(label)) {
            condition.isDriveable = true;
          }
        }

        if (condition.starts === null && /(starts|starter)/.test(label) && value !== null) {
          condition.starts = value;
        }

        if (condition.hasDamage === null && /(damage|skader)/.test(label) && value !== null) {
          condition.hasDamage = value;
        }
      }

      cleaned = cleaned.slice(humanTagMatch[0].length);
    }
  }

  const hasAnyCondition =
    condition.isDriveable !== null || condition.starts !== null || condition.hasDamage !== null;

  return {
    cleanDescription: cleaned.trim(),
    condition: hasAnyCondition ? condition : null,
  };
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export default function RequestDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const router = useRouter();

  const [request, setRequest] = useState<CargoRequest | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [acceptingBid, setAcceptingBid] = useState<string | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const flatListRef = useRef(null);
  const mapRef = useRef<MapView | null>(null);
  const vehicleConditionFadeAnim = useRef(new Animated.Value(0)).current;
  const language = i18n?.language || 'en';
  const locale = language.startsWith('no') ? 'nb-NO' : 'en-US';

  const formatNokAmount = (value: number) => {
    const formatted = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
    return `${formatted} kr`;
  };


  const normalizedRequestStatus = (request?.status || 'pending').toLowerCase();

  const requestStatusMeta = React.useMemo(() => {
    switch (normalizedRequestStatus) {
      case 'in_transit':
        return {
          label: t('in_transit') || 'In transit',
          textColor: colors.status.warning,
          backgroundColor: colors.badge.background,
        };
      case 'delivered':
      case 'completed':
        return {
          label: t('delivered') || 'Delivered',
          textColor: colors.status.success,
          backgroundColor: colors.status.successBackground,
        };
      case 'cancelled':
      case 'canceled':
        return {
          label: t('cancelled') || 'Cancelled',
          textColor: colors.status.error,
          backgroundColor: colors.status.errorBackground,
        };
      case 'open':
      case 'active':
        return {
          label: t('active') || 'Active',
          textColor: colors.status.info,
          backgroundColor: colors.badge.background,
        };
      case 'pending':
      default:
        return {
          label: t('pending') || 'Pending',
          textColor: colors.text.secondary,
          backgroundColor: colors.badge.background,
        };
    }
  }, [normalizedRequestStatus, t]);

  const automotiveDetails = React.useMemo(() => {
    if (request?.cargo_type !== 'automotive') {
      return {
        cleanDescription: request?.description || '',
        condition: null as AutomotiveCondition | null,
        details: null as AutomotiveMetaDetails | null,
      };
    }
    const conditionFromMeta = parseAutomotiveMeta(request.automotive_meta || null);
    const detailsFromMeta = parseAutomotiveMetaDetails(request.automotive_meta || null);
    const parsedLegacy = parseAutomotiveDescription(request.description);
    if (conditionFromMeta) {
      return {
        cleanDescription: parsedLegacy.cleanDescription,
        condition: conditionFromMeta,
        details: detailsFromMeta,
      };
    }

    return {
      ...parsedLegacy,
      details: detailsFromMeta,
    };
  }, [request?.automotive_meta, request?.cargo_type, request?.description]);

  const hasAutomotiveCondition = Boolean(automotiveDetails.condition);
  const hasAutomotiveMetaDetails = Boolean(automotiveDetails.details);
  const shouldShowDeliveryChecklist =
    request?.user_id === user?.uid &&
    ['accepted', 'in_transit', 'delivered', 'completed'].includes(normalizedRequestStatus);
  const deliveryChecklist = [
    {
      key: 'pickup',
      label: t('pickupConfirmed') || 'Pickup confirmed',
      done: ['accepted', 'in_transit', 'delivered', 'completed'].includes(normalizedRequestStatus),
    },
    {
      key: 'in_transit',
      label: t('in_transit') || 'In transit',
      done: ['in_transit', 'delivered', 'completed'].includes(normalizedRequestStatus),
    },
    {
      key: 'delivered',
      label: t('delivered') || 'Delivered',
      done: ['delivered', 'completed'].includes(normalizedRequestStatus),
    },
  ];

  useEffect(() => {
    if (!hasAutomotiveCondition) {
      vehicleConditionFadeAnim.setValue(0);
      return;
    }

    vehicleConditionFadeAnim.setValue(0);
    Animated.timing(vehicleConditionFadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [hasAutomotiveCondition, vehicleConditionFadeAnim]);

  const renderVehicleConditionBadge = (
    value: boolean | null,
    options?: { invertForDisplay?: boolean }
  ) => {
    const displayPositive = value === null ? null : options?.invertForDisplay ? !value : value;

    const badgeStyle =
      value === null
        ? styles.vehicleConditionValueUnknown
        : displayPositive
          ? styles.vehicleConditionValueYes
          : styles.vehicleConditionValueNo;

    const textStyle =
      value === null
        ? styles.vehicleConditionValueTextUnknown
        : displayPositive
          ? styles.vehicleConditionValueTextYes
          : styles.vehicleConditionValueTextNo;

    const iconName: React.ComponentProps<typeof Ionicons>['name'] =
      value === null ? 'remove-circle-outline' : displayPositive ? 'checkmark-circle' : 'close-circle';

    const iconColor =
      value === null
        ? colors.text.secondary
        : displayPositive
          ? colors.status.success
          : colors.status.error;

    const label = value === null ? '-' : value ? t('yes') : t('no');

    return (
      <View style={[styles.vehicleConditionValue, badgeStyle]}>
        <Ionicons name={iconName} size={14} color={iconColor} style={styles.vehicleConditionValueIcon} />
        <Text style={[styles.vehicleConditionValueText, textStyle]}>{label}</Text>
      </View>
    );
  };

  const renderBooleanText = (value?: boolean) => {
    if (typeof value !== 'boolean') {
      return '-';
    }
    return value ? t('yes') : t('no');
  };

  const getEtaRiskLabel = (onTimeRate?: number | null) => {
    if (typeof onTimeRate !== 'number' || Number.isNaN(onTimeRate)) {
      return t('riskUnknown');
    }
    if (onTimeRate >= 90) {
      return t('riskLow');
    }
    if (onTimeRate >= 75) {
      return t('riskMedium');
    }
    return t('riskHigh');
  };

  useEffect(() => {
    fetchRequest();
    fetchBids();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const { data: requestRow, error: requestError } = await supabase
        .from('cargo_requests')
        .select('*')
        .eq('id', id as string)
        .maybeSingle();

      if (requestError || !requestRow) {
        toast.error(t('failedToLoadRequest') || 'Request not found');
        triggerHapticFeedback.error();
        router.back();
        return;
      }

      const data = { ...requestRow } as unknown as CargoRequest;
      const ownerId = requestRow.customer_id || '';
      data.user_id = ownerId;
      data.customer_id = ownerId;
      data.weight =
        typeof requestRow.weight_kg === 'number'
          ? requestRow.weight_kg
          : typeof requestRow.weight_kg === 'string'
            ? Number(requestRow.weight_kg)
            : 0;

      const normalizedImages = normalizeCargoImageInputs(requestRow.images);
      data.images = await resolveCargoImageUrls(normalizedImages);

      // Fetch customer info
      if (data.user_id) {
        const { data: userRow } = await supabase
          .from('profiles')
          .select('full_name, user_type, rating, phone, avatar_url')
          .eq('id', data.user_id)
          .maybeSingle();
        if (userRow) {
          data.users = userRow as CargoRequest['users'];
        }
      }

      setRequest(data);
    } catch (error) {
      console.error('Error fetching request:', error);
      toast.error(t('failedToLoadRequest') || 'Failed to load request');
      triggerHapticFeedback.error();
    } finally {
      setLoading(false);
    }
  };

  const fetchBids = async () => {
    try {
      const { data: bidsRows, error: bidsError } = await supabase
        .from('bids')
        .select('id, price, note, status, created_at, carrier_id')
        .eq('request_id', id as string)
        .order('created_at', { ascending: false });

      if (bidsError) {
        throw bidsError;
      }

      const carrierIds = Array.from(
        new Set(
          (bidsRows || [])
            .map(row => row.carrier_id)
            .filter((value): value is string => Boolean(value))
        )
      );

      const { data: carriersData } = carrierIds.length
        ? await supabase
          .from('profiles')
          .select('id, full_name, user_type, rating, phone, avatar_url')
          .in('id', carrierIds)
        : {
          data: [] as Array<{
            id: string;
            full_name: string | null;
            user_type: string | null;
            rating: number | null;
            phone: string | null;
            avatar_url: string | null;
          }>,
        };

      let completedByCarrier = new Map<string, number>();
      let reviewsByCarrier = new Map<string, number>();
      let onTimeRateByCarrier = new Map<string, number>();

      if (carrierIds.length) {
        const { data: completedRows } = await supabase
          .from('orders')
          .select('carrier_id, request_id, delivered_at')
          .in('carrier_id', carrierIds)
          .eq('status', 'delivered');

        if (completedRows?.length) {
          completedByCarrier = completedRows.reduce((acc, row) => {
            if (!row.carrier_id) {
              return acc;
            }
            acc.set(row.carrier_id, (acc.get(row.carrier_id) || 0) + 1);
            return acc;
          }, new Map<string, number>());

          const deliveredRowsWithRequest = completedRows.filter(
            (row): row is { carrier_id: string; request_id: string; delivered_at: string } =>
              Boolean(row.carrier_id && row.request_id && row.delivered_at)
          );

          const deliveredRequestIds = Array.from(
            new Set(deliveredRowsWithRequest.map(row => row.request_id))
          );

          if (deliveredRequestIds.length > 0) {
            const { data: requestsForOnTime } = await supabase
              .from('cargo_requests')
              .select('id, delivery_date')
              .in('id', deliveredRequestIds);

            const promisedDateByRequest = new Map<string, string>();
            for (const row of requestsForOnTime || []) {
              if (row.id && row.delivery_date) {
                promisedDateByRequest.set(row.id, row.delivery_date);
              }
            }

            const onTimeStats = new Map<string, { onTime: number; total: number }>();

            for (const row of deliveredRowsWithRequest) {
              const promisedDate = promisedDateByRequest.get(row.request_id);
              if (!promisedDate) {
                continue;
              }

              const deliveredAt = new Date(row.delivered_at);
              const promisedAt = new Date(`${promisedDate}T23:59:59.999Z`);

              if (Number.isNaN(deliveredAt.getTime()) || Number.isNaN(promisedAt.getTime())) {
                continue;
              }

              const current = onTimeStats.get(row.carrier_id) || { onTime: 0, total: 0 };
              current.total += 1;
              if (deliveredAt.getTime() <= promisedAt.getTime()) {
                current.onTime += 1;
              }
              onTimeStats.set(row.carrier_id, current);
            }

            for (const [carrierId, stats] of onTimeStats.entries()) {
              if (stats.total > 0) {
                onTimeRateByCarrier.set(carrierId, (stats.onTime / stats.total) * 100);
              }
            }
          }
        }

        const { data: reviewsRows } = await supabase
          .from('reviews')
          .select('reviewed_id')
          .in('reviewed_id', carrierIds);

        if (reviewsRows?.length) {
          reviewsByCarrier = reviewsRows.reduce((acc, row) => {
            if (!row.reviewed_id) {
              return acc;
            }
            acc.set(row.reviewed_id, (acc.get(row.reviewed_id) || 0) + 1);
            return acc;
          }, new Map<string, number>());
        }
      }

      const carrierById = new Map((carriersData || []).map(carrier => [carrier.id, carrier]));

      const bidsData = (bidsRows || []).map(row => ({
        id: row.id,
        price: Number(row.price || 0),
        message: row.note || '',
        status: row.status || 'pending',
        created_at: row.created_at,
        carrier_id: row.carrier_id,
        users: row.carrier_id
          ? (() => {
            const carrier = carrierById.get(row.carrier_id);
            return carrier
              ? {
                full_name: carrier.full_name || '',
                user_type: carrier.user_type || 'carrier',
                rating: Number(carrier.rating || 0),
                phone: carrier.phone || '',
                avatar_url: carrier.avatar_url || undefined,
                completed_transports: completedByCarrier.get(row.carrier_id) || 0,
                review_count: reviewsByCarrier.get(row.carrier_id) || 0,
                on_time_rate: onTimeRateByCarrier.get(row.carrier_id) || null,
              }
              : undefined;
          })()
          : undefined,
      })) as Bid[];

      setBids(bidsData);
    } catch (error) {
      console.error('Error fetching bids:', error);
    }
  };

  const submitBid = async () => {
    if (!bidAmount.trim()) {
      toast.error(t('invalidBidAmount') || 'Please enter a valid bid amount');
      triggerHapticFeedback.error();
      return;
    }

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('invalidBidAmount') || 'Please enter a valid bid amount');
      triggerHapticFeedback.error();
      return;
    }

    setSubmittingBid(true);
    triggerHapticFeedback.medium();

    try {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      const { error: insertBidError } = await supabase.from('bids').insert({
        request_id: id as string,
        carrier_id: user.uid,
        price: amount,
        note: null,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      if (insertBidError) {
        throw insertBidError;
      }

      // Track bid submitted
      trackBidSubmitted({
        request_id: id as string,
        amount: amount,
        carrier_id: user.uid,
      });

      setBidAmount('');
      fetchBids();

      // Show success animation
      triggerHapticFeedback.success();
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
        toast.success(t('bidSubmitted') || 'Bid submitted successfully');
        router.replace('/(tabs)/orders' as never);
      }, 800);
    } catch (error) {
      console.error('Error submitting bid:', error);
      toast.error('Kunne ikke sende bud. Prøv igjen.');
      triggerHapticFeedback.error();
    } finally {
      setSubmittingBid(false);
    }
  };

  const acceptBid = async (bid: Bid) => {
    Alert.alert(
      t('acceptBid'),
      t('acceptBidConfirmation', {
        amount: formatNokAmount(bid.price),
        carrier: bid.users?.full_name || '',
      }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('acceptAndPay'),
          onPress: () => processBidAcceptance(bid),
        },
      ]
    );
  };

  const processBidAcceptance = async (bid: Bid) => {
    if (!request || request.user_id !== user?.uid) {
      Alert.alert('Feil', 'Du kan bare godta bud på dine egne forespørsler');
      triggerHapticFeedback.error();
      return;
    }

    setAcceptingBid(bid.id);
    triggerHapticFeedback.medium();

    try {
      const { orderId, error } = await acceptBidEdgeFn(bid.id);

      if (error || !orderId) {
        throw error || new Error('Kunne ikke godta bud');
      }

      // Track bid accepted
      trackBidAccepted({
        request_id: id as string,
        bid_id: bid.id,
        bid_amount: bid.price,
        carrier_id: bid.carrier_id,
      });

      // Refresh UI
      fetchBids();
      fetchRequest();

      triggerHapticFeedback.success();
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
        Alert.alert(t('bidAccepted'), t('bidAcceptedNextStep'), [
          {
            text: t('proceedToPayment'),
            onPress: () => router.push(`/payment/${orderId}` as never),
          },
        ]);
      }, 800);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Kunne ikke godta bud';
      toast.error(errorMessage);
      triggerHapticFeedback.error();
    } finally {
      setAcceptingBid(null);
    }
  };

  const handleOpenCustomerProfile = () => {
    if (!request?.user_id) return;
    router.push(`/profile/${request.user_id}` as never);
    triggerHapticFeedback.light();
  };

  const openImageGallery = (index: number) => {
    setSelectedImageIndex(index);
    setShowImageGallery(true);
    triggerHapticFeedback.light();
  };

  const closeImageGallery = () => {
    setShowImageGallery(false);
  };

  const handleEdit = () => {
    if (!request) return;
    // Check if request has accepted bids
    const hasAcceptedBid = bids.some(bid => bid.status === 'accepted');
    if (hasAcceptedBid) {
      Alert.alert(
        t('error'),
        t('cannotEditAcceptedRequest') || 'Cannot edit request with accepted bids'
      );
      return;
    }

    triggerHapticFeedback.light();
    router.push(`/edit-request/${id}`);
  };

  const handleDelete = () => {
    if (deleting) {
      return;
    }

    const bidCount = bids.length;
    const requestTitle = request?.title || t('cargoRequest') || 'Request';
    const message =
      bidCount > 0
        ? `${t('confirmDeleteMessage') || 'Are you sure you want to delete this request? This action cannot be undone.'}\n\n"${requestTitle}"\n${bidCount} ${bidCount === 1 ? 'bid' : 'bids'} ${t('willBeDeleted') || 'will also be deleted'}.`
        : `${t('confirmDeleteMessage') || 'Are you sure you want to delete this request? This action cannot be undone.'}\n\n"${requestTitle}"`;

    Alert.alert(t('confirmDelete') || 'Delete Request', message, [
      { text: t('cancel') || 'Cancel', style: 'cancel' },
      {
        text: t('delete') || 'Delete',
        style: 'destructive',
        onPress: confirmDelete,
      },
    ]);
  };

  const handleOpenInNavigator = async () => {
    const fromLat = toFiniteNumber(request?.from_lat);
    const fromLng = toFiniteNumber(request?.from_lng);
    const toLat = toFiniteNumber(request?.to_lat);
    const toLng = toFiniteNumber(request?.to_lng);

    const origin =
      fromLat !== null && fromLng !== null ? `${fromLat},${fromLng}` : request?.from_address || '';
    const destination =
      toLat !== null && toLng !== null ? `${toLat},${toLng}` : request?.to_address || '';

    if (!origin && !destination) {
      toast.error(t('couldNotOpenLink') || 'Could not open link');
      return;
    }

    const encodedOrigin = encodeURIComponent(origin);
    const encodedDestination = encodeURIComponent(destination || origin);

    const appleMapsUrl = origin
      ? `http://maps.apple.com/?saddr=${encodedOrigin}&daddr=${encodedDestination}&dirflg=d`
      : `http://maps.apple.com/?daddr=${encodedDestination}&dirflg=d`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${encodedOrigin}` : ''}&destination=${encodedDestination}&travelmode=driving`;
    const googleMapsAppUrl = `comgooglemaps://?${origin ? `saddr=${encodedOrigin}&` : ''}daddr=${encodedDestination}&directionsmode=driving`;
    const androidIntentUrl = `google.navigation:q=${encodedDestination}`;

    const urlCandidates =
      Platform.OS === 'ios'
        ? [appleMapsUrl, googleMapsAppUrl, googleMapsUrl]
        : [androidIntentUrl, googleMapsUrl];

    try {
      for (const url of urlCandidates) {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          return;
        }
      }

      toast.error(t('couldNotOpenLink') || 'Could not open link');
    } catch (error) {
      console.error('Failed to open navigator:', error);
      toast.error(t('couldNotOpenLink') || 'Could not open link');
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    triggerHapticFeedback.medium();

    try {
      const requestId = id as string;

      // Best-effort: remove unpaid orders tied to this request
      // (covers cases where bid was accepted but payment never completed)
      const { data: unpaidOrders, error: unpaidOrdersError } = await supabase
        .from('orders')
        .select('id')
        .eq('request_id', requestId)
        .in('payment_status', ['pending', 'initiated', 'failed']);

      if (unpaidOrdersError) {
        console.warn('Could not fetch unpaid related orders:', unpaidOrdersError);
      } else {
        const unpaidOrderIds = (unpaidOrders || []).map(row => row.id);
        if (unpaidOrderIds.length > 0) {
          const { error: deleteOrdersError } = await supabase
            .from('orders')
            .delete()
            .in('id', unpaidOrderIds);

          if (deleteOrdersError) {
            console.warn('Could not delete unpaid related orders:', deleteOrdersError);
          }
        }
      }

      // Delete all bids for this request
      const { data: requestBids, error: requestBidsError } = await supabase
        .from('bids')
        .select('id')
        .eq('request_id', requestId);

      if (requestBidsError) {
        throw requestBidsError;
      }

      const bidIds = (requestBids || []).map(row => row.id);
      if (bidIds.length > 0) {
        const { error: deleteBidsError } = await supabase.from('bids').delete().in('id', bidIds);
        if (deleteBidsError) {
          throw deleteBidsError;
        }
      }

      // Delete the cargo request
      const { error: deleteRequestError } = await supabase
        .from('cargo_requests')
        .delete()
        .eq('id', requestId);

      if (deleteRequestError) {
        throw deleteRequestError;
      }

      // 📊 Track request deletion
      trackCargoRequestDeleted({
        request_id: requestId,
        cargo_type: request?.cargo_type,
        had_bids: bidIds.length > 0,
        bid_count: bidIds.length,
      });

      triggerHapticFeedback.success();
      toast.success(t('requestDeleted') || 'Request deleted successfully');
      // Navigate back to home
      router.back();
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error(t('failedToDelete') || 'Failed to delete request');
      triggerHapticFeedback.error();
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTimestamp = (timestamp: unknown) => {
    if (!timestamp) return '';
    const date =
      typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp
        ? (timestamp as { toDate: () => Date }).toDate()
        : new Date(timestamp as string);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  };

  const isCustomer = request?.user_id === user?.uid;
  const canSubmitBid = !isCustomer && ['open', 'bidding'].includes(normalizedRequestStatus);
  const hasBidFromUser = bids.some(bid => bid.carrier_id === user?.uid);

  const renderItem = ({ item }: { item: string; index: number }) => {
    switch (item) {
      case 'header':
        return null;

      case 'images':
        if (!request?.images || request.images.length === 0) return null;

        if (request.images.length === 1) {
          return (
            <View style={styles.imagesSection}>
              <TouchableOpacity
                onPress={() => openImageGallery(0)}
                style={[styles.imageContainer, styles.singleImageContainer]}
                testID="request-image-single"
                accessibilityRole="button"
                accessibilityLabel="Open image"
              >
                <LazyImage uri={request.images[0]} style={styles.image} />
              </TouchableOpacity>
            </View>
          );
        }

        return (
          <View style={styles.imagesSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imagesScroll}
              testID="request-images-scroll"
            >
              {request.images.map((imageUrl, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => openImageGallery(idx)}
                  style={styles.imageContainer}
                  accessibilityRole="button"
                  accessibilityLabel={`Open image ${idx + 1}`}
                >
                  <LazyImage uri={imageUrl} style={styles.image} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      case 'info':
        return (
          <View style={styles.section}>
            <Text style={styles.title}>{request?.title}</Text>
            <View
              style={[
                styles.requestStatusBadge,
                { backgroundColor: requestStatusMeta.backgroundColor },
              ]}
            >
              <Text style={[styles.requestStatusBadgeText, { color: requestStatusMeta.textColor }]}>
                {requestStatusMeta.label}
              </Text>
            </View>
            {automotiveDetails.condition && (
              <Animated.View
                style={[styles.vehicleConditionCardDetails, { opacity: vehicleConditionFadeAnim }]}
              >
                <Text style={styles.vehicleConditionTitle}>{t('vehicleCondition')}</Text>
                <View style={styles.vehicleConditionRowDetails}>
                  <Text style={styles.vehicleConditionLabel}>{t('vehicleIsDriveable')}</Text>
                  {renderVehicleConditionBadge(automotiveDetails.condition.isDriveable)}
                </View>
                <View style={styles.vehicleConditionRowDetails}>
                  <Text style={styles.vehicleConditionLabel}>{t('vehicleStarts')}</Text>
                  {renderVehicleConditionBadge(automotiveDetails.condition.starts)}
                </View>
                <View style={styles.vehicleConditionRowDetails}>
                  <Text style={styles.vehicleConditionLabel}>{t('vehicleHasDamage')}</Text>
                  {renderVehicleConditionBadge(automotiveDetails.condition.hasDamage, {
                    invertForDisplay: true,
                  })}
                </View>
              </Animated.View>
            )}
            {hasAutomotiveMetaDetails && (
              <View style={styles.vehicleMetaCard}>
                <Text style={styles.vehicleConditionTitle}>{t('vehicleDetails')}</Text>

                <View style={styles.vehicleConditionRowDetails}>
                  <Text style={styles.vehicleConditionLabel}>{t('transportType')}</Text>
                  <Text style={styles.vehicleMetaValue}>
                    {automotiveDetails.details?.transportType === 'enclosed'
                      ? t('enclosedTrailer')
                      : automotiveDetails.details?.transportType === 'open'
                        ? t('openTrailer')
                        : '-'}
                  </Text>
                </View>

                <View style={styles.vehicleConditionRowDetails}>
                  <Text style={styles.vehicleConditionLabel}>VIN</Text>
                  <Text style={styles.vehicleMetaValue}>{automotiveDetails.details?.vin || '-'}</Text>
                </View>

                <View style={styles.vehicleConditionRowDetails}>
                  <Text style={styles.vehicleConditionLabel}>{t('keysIncluded')}</Text>
                  <Text style={styles.vehicleMetaValue}>
                    {renderBooleanText(automotiveDetails.details?.hasKeys)}
                  </Text>
                </View>

                <View style={styles.vehicleConditionRowDetails}>
                  <Text style={styles.vehicleConditionLabel}>{t('wheelLock')}</Text>
                  <Text style={styles.vehicleMetaValue}>
                    {renderBooleanText(automotiveDetails.details?.hasWheelLock)}
                  </Text>
                </View>

                <View style={styles.vehicleConditionRowDetails}>
                  <Text style={styles.vehicleConditionLabel}>{t('groundClearance')}</Text>
                  <Text style={styles.vehicleMetaValue}>
                    {typeof automotiveDetails.details?.groundClearanceCm === 'number'
                      ? `${automotiveDetails.details.groundClearanceCm} cm`
                      : '-'}
                  </Text>
                </View>

                <View style={styles.vehicleConditionRowDetails}>
                  <Text style={styles.vehicleConditionLabel}>{t('needsWinch')}</Text>
                  <Text style={styles.vehicleMetaValue}>
                    {renderBooleanText(automotiveDetails.details?.needsWinch)}
                  </Text>
                </View>
              </View>
            )}
            <Text style={styles.description}>{automotiveDetails.cleanDescription || request?.description}</Text>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Ionicons name="cube-outline" size={20} color={colors.primary} />
                <Text style={styles.infoLabel}>{t('cargoType') || 'Type'}</Text>
                <Text style={styles.infoValue}>{t(request?.cargo_type || '')}</Text>
              </View>

              <View style={styles.infoItem}>
                <Ionicons name="scale-outline" size={20} color={colors.primary} />
                <Text style={styles.infoLabel}>{t('weight') || 'Weight'}</Text>
                <Text style={styles.infoValue}>{request?.weight} kg</Text>
              </View>

              {request?.dimensions && (
                <View style={styles.infoItem}>
                  <Ionicons name="resize-outline" size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>{t('dimensions') || 'Dimensions'}</Text>
                  <Text style={styles.infoValue}>{request.dimensions}</Text>
                </View>
              )}

              <View style={styles.infoItem}>
                <Ionicons name="cash-outline" size={20} color={colors.primary} />
                <Text style={styles.infoLabel}>{t('price') || 'Price'}</Text>
                <Text style={styles.infoValue}>
                  {request?.price_type === 'negotiable'
                    ? t('negotiable')
                    : formatNokAmount(request?.price || 0)}
                </Text>
              </View>
            </View>
          </View>
        );

      case 'route': {
        const fromLat = toFiniteNumber(request?.from_lat);
        const fromLng = toFiniteNumber(request?.from_lng);
        const toLat = toFiniteNumber(request?.to_lat);
        const toLng = toFiniteNumber(request?.to_lng);
        const distanceKm = toFiniteNumber(request?.distance_km);

        // Show map if coordinates are available, otherwise show text addresses
        if (fromLat !== null && fromLng !== null && toLat !== null && toLng !== null) {
          // Calculate center point and initial region
          const centerLat = (fromLat + toLat) / 2;
          const centerLng = (fromLng + toLng) / 2;
          const latDelta = Math.max(Math.abs(fromLat - toLat) * 1.5, 0.05);
          const lngDelta = Math.max(Math.abs(fromLng - toLng) * 1.5, 0.05);

          return (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.sectionTitleStrong]}>
                {t('route') || 'Route'}
              </Text>
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  initialRegion={{
                    latitude: centerLat,
                    longitude: centerLng,
                    latitudeDelta: latDelta,
                    longitudeDelta: lngDelta,
                  }}
                  onMapReady={() => {
                    mapRef.current?.fitToCoordinates(
                      [
                        { latitude: fromLat, longitude: fromLng },
                        { latitude: toLat, longitude: toLng },
                      ],
                      {
                        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                        animated: false,
                      }
                    );
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                >
                  {/* FROM marker — green branded circle */}
                  <Marker
                    coordinate={{ latitude: fromLat, longitude: fromLng }}
                    title={t('pickup')}
                    description={request?.from_address || ''}
                  >
                    <View style={styles.markerFrom}>
                      <View style={styles.markerInner} />
                    </View>
                  </Marker>

                  {/* TO marker — red branded circle */}
                  <Marker
                    coordinate={{ latitude: toLat, longitude: toLng }}
                    title={t('to')}
                    description={request?.to_address || ''}
                  >
                    <View style={styles.markerTo}>
                      <View style={styles.markerInner} />
                    </View>
                  </Marker>

                  {/* Dashed route line */}
                  <Polyline
                    coordinates={[
                      { latitude: fromLat, longitude: fromLng },
                      { latitude: toLat, longitude: toLng },
                    ]}
                    strokeColor={colors.primary}
                    strokeWidth={2.5}
                    lineDashPattern={[8, 6]}
                    lineCap="round"
                  />
                </MapView>

                {distanceKm !== null && (
                  <View style={styles.distanceBadge}>
                    <Ionicons name="navigate-outline" size={16} color="#FFF" />
                    <Text style={styles.distanceBadgeText}>{distanceKm.toFixed(0)} km</Text>
                  </View>
                )}
              </View>

              {/* Route info below map */}
              <View style={styles.routeInfoBox}>
                <View style={styles.routeInfoRow}>
                  <Ionicons name="location" size={18} color={colors.success} />
                  <View style={styles.routeInfoCol}>
                    <Text style={styles.routeLabel}>{t('from') || 'From'}</Text>
                    <Text style={styles.routeAddress}>{request?.from_address || ''}</Text>
                    <Text style={styles.routeDate}>{formatDate(request?.pickup_date || '')}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.routeInfoRow}>
                  <Ionicons name="location" size={18} color={colors.error} />
                  <View style={styles.routeInfoCol}>
                    <Text style={styles.routeLabel}>{t('to') || 'To'}</Text>
                    <Text style={styles.routeAddress}>{request?.to_address || ''}</Text>
                    <Text style={styles.routeDate}>{formatDate(request?.delivery_date || '')}</Text>
                  </View>
                </View>
              </View>

              {distanceKm !== null && (
                <View style={styles.distanceInfo}>
                  <Ionicons name="navigate-outline" size={16} color={colors.text.secondary} />
                  <Text style={styles.distanceText}>{distanceKm.toFixed(0)} km</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.navigationButton}
                onPress={handleOpenInNavigator}
                accessibilityRole="button"
                accessibilityLabel={t('openInNavigator') || 'Open in navigator'}
              >
                <Ionicons name="navigate" size={18} color={colors.white} />
                <Text style={styles.navigationButtonText}>
                  {t('openInNavigator') || 'Open in navigator'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        } else {
          // Fallback to text view if no coordinates
          return (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.sectionTitleStrong]}>
                {t('route') || 'Route'}
              </Text>

              <View style={styles.routeRow}>
                <Ionicons name="location" size={24} color={colors.success} />
                <View style={styles.routeInfo}>
                  <Text style={styles.routeLabel}>{t('from') || 'From'}</Text>
                  <Text style={styles.routeAddress}>{request?.from_address}</Text>
                  <Text style={styles.routeDate}>{formatDate(request?.pickup_date || '')}</Text>
                </View>
              </View>

              <View style={styles.routeDivider}>
                <View style={styles.routeLine} />
                <Ionicons name="arrow-down" size={16} color={colors.text.tertiary} />
              </View>

              <View style={styles.routeRow}>
                <Ionicons name="location" size={24} color={colors.error} />
                <View style={styles.routeInfo}>
                  <Text style={styles.routeLabel}>{t('to') || 'To'}</Text>
                  <Text style={styles.routeAddress}>{request?.to_address}</Text>
                  <Text style={styles.routeDate}>{formatDate(request?.delivery_date || '')}</Text>
                </View>
              </View>

              {distanceKm !== null && (
                <View style={styles.distanceInfo}>
                  <Ionicons name="navigate-outline" size={16} color={colors.text.secondary} />
                  <Text style={styles.distanceText}>{distanceKm.toFixed(0)} km</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.navigationButton}
                onPress={handleOpenInNavigator}
                accessibilityRole="button"
                accessibilityLabel={t('openInNavigator') || 'Open in navigator'}
              >
                <Ionicons name="navigate" size={18} color={colors.white} />
                <Text style={styles.navigationButtonText}>
                  {t('openInNavigator') || 'Open in navigator'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }
      }

      case 'customer':
        if (!request?.users) return null;
        return (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.sectionTitleStrong]}>
              {t('customer') || 'Kunde'}
            </Text>

            <View style={styles.customerCard}>
              <View style={styles.customerMainRow}>
                <Avatar photoURL={request.users.avatar_url} size={48} />
                <View style={styles.customerInfo}>
                  <Text style={styles.customerName}>{request.users.full_name}</Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={16} color="#FFA726" />
                    <Text style={styles.ratingText}>
                      {typeof request.users.rating === 'number'
                        ? request.users.rating.toFixed(1)
                        : '0.0'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.profileButton}
                  onPress={handleOpenCustomerProfile}
                  accessibilityRole="button"
                  accessibilityLabel={t('viewProfile') || 'View Profile'}
                >
                  <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.profileButtonText}>{t('viewProfile') || 'View Profile'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );

      case 'checklist':
        if (!shouldShowDeliveryChecklist) return null;
        return (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.sectionTitleStrong]}>{t('deliveryChecklist')}</Text>
            <View style={styles.checklistContainer}>
              {deliveryChecklist.map(step => (
                <View key={step.key} style={styles.checklistRow}>
                  <View
                    style={[
                      styles.checklistDot,
                      step.done ? styles.checklistDotDone : styles.checklistDotPending,
                    ]}
                  >
                    <Ionicons
                      name={step.done ? 'checkmark' : 'ellipse-outline'}
                      size={12}
                      color={step.done ? colors.white : colors.text.secondary}
                    />
                  </View>
                  <Text style={[styles.checklistText, step.done && styles.checklistTextDone]}>
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 'bidForm':
        if (!canSubmitBid || hasBidFromUser) return null;
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('submitBid')}</Text>

            <View style={styles.bidForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('bidAmount')} (kr)</Text>
                <TextInput
                  style={styles.input}
                  value={bidAmount}
                  onChangeText={setBidAmount}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submittingBid && styles.submitButtonDisabled]}
                onPress={submitBid}
                disabled={submittingBid}
                accessibilityRole="button"
                accessibilityLabel={submittingBid ? t('processing') : t('submitBid')}
              >
                {submittingBid ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color={colors.white} />
                    <Text style={styles.submitButtonText}>{t('submitBid')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'bids':
        if (bids.length === 0) return null;
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bud ({bids.length})</Text>

            {bids.map(bid => (
              <View key={bid.id} style={styles.bidCard}>
                <View style={styles.bidHeader}>
                  <Avatar photoURL={bid.users?.avatar_url} size={40} />
                  <View style={styles.bidUserInfo}>
                    <Text style={styles.bidUserName}>{bid.users?.full_name}</Text>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={14} color="#FFA726" />
                      <Text style={styles.bidRating}>
                        {typeof bid.users?.rating === 'number'
                          ? bid.users.rating.toFixed(1)
                          : '0.0'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.bidPriceContainer}>
                    <Text style={styles.bidPrice}>{formatNokAmount(bid.price)}</Text>
                    <Text style={styles.bidDate}>{formatTimestamp(bid.created_at)}</Text>
                  </View>
                </View>

                {bid.message && <Text style={styles.bidMessage}>{bid.message}</Text>}

                <View style={styles.bidQualityRow}>
                  <View style={styles.bidQualityChip}>
                    <Ionicons name="car-outline" size={12} color={colors.text.secondary} />
                    <Text style={styles.bidQualityText}>
                      {bid.users?.completed_transports || 0} {t('completedShort')}
                    </Text>
                  </View>
                  <View style={styles.bidQualityChip}>
                    <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.text.secondary} />
                    <Text style={styles.bidQualityText}>{bid.users?.review_count || 0} {t('reviews')}</Text>
                  </View>
                  <View style={styles.bidQualityChip}>
                    <Ionicons name="time-outline" size={12} color={colors.text.secondary} />
                    <Text style={styles.bidQualityText}>
                      {typeof bid.users?.on_time_rate === 'number'
                        ? t('onTimeRate', { value: Math.round(bid.users.on_time_rate) })
                        : t('onTimeNA')}
                    </Text>
                  </View>
                  <View style={styles.bidQualityChip}>
                    <Ionicons name="alert-circle-outline" size={12} color={colors.text.secondary} />
                    <Text style={styles.bidQualityText}>
                      {t('etaRiskLabel')}: {getEtaRiskLabel(bid.users?.on_time_rate)}
                    </Text>
                  </View>
                </View>

                <View style={styles.bidFooter}>
                  <View
                    style={[
                      styles.statusBadge,
                      bid.status === 'accepted' && styles.statusBadgeAccepted,
                      bid.status === 'rejected' && styles.statusBadgeRejected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        bid.status === 'accepted' && styles.statusTextAccepted,
                        bid.status === 'rejected' && styles.statusTextRejected,
                      ]}
                    >
                      {bid.status === 'accepted'
                        ? t('accepted')
                        : bid.status === 'rejected'
                          ? t('rejected')
                          : t('waiting')}
                    </Text>
                  </View>

                  {isCustomer && bid.status === 'pending' && (
                    <TouchableOpacity
                      style={[
                        styles.acceptButton,
                        acceptingBid === bid.id && styles.acceptButtonDisabled,
                      ]}
                      onPress={() => acceptBid(bid)}
                      disabled={acceptingBid === bid.id}
                      accessibilityRole="button"
                      accessibilityLabel={
                        acceptingBid === bid.id ? t('processing') : t('acceptBid')
                      }
                    >
                      {acceptingBid === bid.id ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.acceptButtonText}>{t('acceptBid')}</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScreenHeader title={t('requestDetails')} onBackPress={() => router.back()} />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSkeletonSection}>
            <SkeletonLoader variant="text" count={1} />
          </View>
          <View style={styles.loadingSkeletonSection}>
            <SkeletonLoader variant="card" count={1} compact={true} />
          </View>
          <View style={styles.loadingSkeletonSection}>
            <SkeletonLoader variant="list" count={2} />
          </View>
        </View>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.text.tertiary} />
        <Text style={styles.errorText}>{t('requestNotFound')}</Text>
        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('goBack')}
        >
          <Text style={styles.errorButtonText}>{t('goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sections = ['images', 'info', 'route', 'customer', 'checklist', 'bidForm', 'bids'];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScreenHeader
        title={t('requestDetails')}
        onBackPress={() => router.back()}
        secondaryRightAction={
          isCustomer
            ? {
              icon: 'create-outline',
              onPress: handleEdit,
              label: t('editRequest'),
            }
            : undefined
        }
        rightAction={
          isCustomer
            ? {
              icon: 'trash-outline',
              onPress: handleDelete,
              label: t('deleteRequest'),
            }
            : undefined
        }
      />

      <KeyboardAwareFlatList
        ref={flatListRef}
        data={sections}
        renderItem={renderItem}
        keyExtractor={item => item}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={20}
      />

      {/* Image Gallery Modal */}
      <Modal visible={showImageGallery} transparent animationType="fade">
        <View style={styles.galleryModal}>
          <TouchableOpacity
            style={styles.galleryCloseButton}
            onPress={closeImageGallery}
            accessibilityRole="button"
            accessibilityLabel="Close image gallery"
          >
            <Ionicons name="close" size={32} color={colors.white} />
          </TouchableOpacity>

          <Image
            source={{ uri: request.images?.[selectedImageIndex] }}
            style={styles.galleryImage}
            resizeMode="contain"
          />

          {request.images && request.images.length > 1 && (
            <View style={styles.galleryIndicator}>
              <Text style={styles.galleryIndicatorText}>
                {selectedImageIndex + 1} / {request.images.length}
              </Text>
            </View>
          )}

          {request.images && request.images.length > 1 && selectedImageIndex > 0 && (
            <TouchableOpacity
              style={[styles.galleryNavButton, styles.galleryNavButtonLeft]}
              onPress={() => setSelectedImageIndex(selectedImageIndex - 1)}
              accessibilityRole="button"
              accessibilityLabel="Previous image"
            >
              <Ionicons name="chevron-back" size={32} color={colors.white} />
            </TouchableOpacity>
          )}

          {request.images &&
            request.images.length > 1 &&
            selectedImageIndex < request.images.length - 1 && (
              <TouchableOpacity
                style={[styles.galleryNavButton, styles.galleryNavButtonRight]}
                onPress={() => setSelectedImageIndex(selectedImageIndex + 1)}
                accessibilityRole="button"
                accessibilityLabel="Next image"
              >
                <Ionicons name="chevron-forward" size={32} color={colors.white} />
              </TouchableOpacity>
            )}
        </View>
      </Modal>

      {/* Success Animation */}
      {showSuccessAnimation && <SuccessAnimation visible={showSuccessAnimation} type="checkmark" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.backgroundLight,
    gap: spacing.md,
  },
  loadingSkeletonSection: {
    width: '100%',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    padding: spacing.xl,
  },
  errorText: {
    marginTop: spacing.lg,
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  errorButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  errorButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.white,
  },
  content: {
    paddingBottom: spacing.xxxl,
  },
  imagesSection: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
  },
  imagesScroll: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  singleImageContainer: {
    width: '100%',
    height: 230,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  section: {
    backgroundColor: colors.white,
    marginTop: spacing.sm,
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  requestStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  requestStatusBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  description: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  vehicleConditionCardDetails: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  vehicleConditionTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  vehicleConditionRowDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicleConditionLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  vehicleConditionValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxxs,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  vehicleConditionValueYes: {
    backgroundColor: colors.status.successBackground,
  },
  vehicleConditionValueNo: {
    backgroundColor: colors.status.errorBackground,
  },
  vehicleConditionValueUnknown: {
    backgroundColor: colors.badge.background,
  },
  vehicleConditionValueIcon: {
    color: colors.text.secondary,
  },
  vehicleConditionValueText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  vehicleConditionValueTextYes: {
    color: colors.status.success,
  },
  vehicleConditionValueTextNo: {
    color: colors.status.error,
  },
  vehicleConditionValueTextUnknown: {
    color: colors.text.secondary,
  },
  vehicleMetaCard: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  vehicleMetaValue: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  sectionTitleStrong: {
    color: colors.text.dark,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.backgroundLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  routeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  routeAddress: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  routeDate: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  routeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.xs,
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: colors.border.light,
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  distanceText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  navigationButton: {
    marginTop: spacing.md,
    minHeight: TOUCH_TARGET.MIN,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  navigationButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.white,
  },
  customerCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  customerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  chatButton: {
    backgroundColor: colors.primary,
    width: TOUCH_TARGET.MIN,
    height: TOUCH_TARGET.MIN,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButton: {
    minHeight: TOUCH_TARGET.MIN,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundPrimary,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  profileButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  bidForm: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.primary,
  },
  input: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.white,
  },
  bidCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  bidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bidUserInfo: {
    flex: 1,
  },
  bidUserName: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  bidRating: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  bidPriceContainer: {
    alignItems: 'flex-end',
  },
  bidPrice: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  bidDate: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  bidMessage: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  bidQualityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  bidQualityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  bidQualityText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  bidFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.badge.background,
  },
  statusBadgeAccepted: {
    backgroundColor: '#E8F5E9',
  },
  statusBadgeRejected: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  statusTextAccepted: {
    color: '#2E7D32',
  },
  statusTextRejected: {
    color: '#C62828',
  },
  acceptButton: {
    backgroundColor: colors.primary,
    minHeight: TOUCH_TARGET.MIN,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.white,
  },
  checklistContainer: {
    backgroundColor: colors.backgroundLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    gap: spacing.sm,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checklistDot: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistDotDone: {
    backgroundColor: colors.status.success,
  },
  checklistDotPending: {
    backgroundColor: colors.badge.background,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  checklistText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  checklistTextDone: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  galleryModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryCloseButton: {
    position: 'absolute',
    top: 50,
    right: spacing.lg,
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  galleryIndicator: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  galleryIndicatorText: {
    fontSize: fontSize.sm,
    color: colors.white,
  },
  galleryNavButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: borderRadius.full,
  },
  galleryNavButtonLeft: {
    left: spacing.lg,
  },
  galleryNavButtonRight: {
    right: spacing.lg,
  },
  map: {
    height: 300,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  mapContainer: {
    position: 'relative',
  },
  markerFrom: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerTo: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
  },
  distanceBadge: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  distanceBadgeText: {
    fontSize: fontSize.sm,
    color: colors.white,
    fontWeight: '600',
  },
  routeInfoBox: {
    backgroundColor: colors.backgroundLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  routeInfoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  routeInfoCol: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.default,
  },
});
