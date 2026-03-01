import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
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
  };
}

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
  const { t } = useTranslation();
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

      const data = { id: requestRow.id, ...requestRow } as CargoRequest;
      const ownerId =
        typeof requestRow.customer_id === 'string'
          ? requestRow.customer_id
          : typeof requestRow.user_id === 'string'
            ? requestRow.user_id
            : '';
      data.user_id = ownerId;
      data.customer_id = ownerId;
      data.weight =
        typeof requestRow.weight === 'number'
          ? requestRow.weight
          : typeof requestRow.weight_kg === 'number'
            ? requestRow.weight_kg
            : typeof requestRow.weight_kg === 'string'
              ? Number(requestRow.weight_kg)
              : 0;

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
      toast.error('Vennligst angi et budbeløp');
      triggerHapticFeedback.error();
      return;
    }

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ugyldig budbeløp');
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
        request_id: id,
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
      'Godta bud',
      `Er du sikker på at du vil godta budet på ${bid.price} NOK fra ${bid.users?.full_name}?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: 'Godta og betal',
          onPress: () => processBidAcceptance(bid),
        },
      ]
    );
  };

  const processBidAcceptance = async (bid: Bid) => {
    // Verify user is the request owner
    if (!request || request.user_id !== user?.uid) {
      Alert.alert('Feil', 'Du kan bare godta bud på dine egne forespørsler');
      triggerHapticFeedback.error();
      return;
    }

    setAcceptingBid(bid.id);
    triggerHapticFeedback.medium();

    try {
      const { data: selectedBid, error: selectedBidError } = await supabase
        .from('bids')
        .select('id, status')
        .eq('id', bid.id)
        .maybeSingle();

      if (selectedBidError || !selectedBid) {
        throw new Error('Bud ikke funnet');
      }

      if (selectedBid.status !== 'pending') {
        throw new Error('Budet er ikke lenger tilgjengelig');
      }

      const { data: currentRequest, error: currentRequestError } = await supabase
        .from('cargo_requests')
        .select('status')
        .eq('id', id as string)
        .maybeSingle();

      if (currentRequestError || !currentRequest) {
        throw new Error('Forespørsel ikke funnet');
      }

      if (!['active', 'open'].includes(currentRequest.status)) {
        throw new Error('Forespørselen er ikke lenger aktiv');
      }

      const nowIso = new Date().toISOString();

      const { error: acceptedBidUpdateError } = await supabase
        .from('bids')
        .update({
          status: 'accepted',
          updated_at: nowIso,
        })
        .eq('id', bid.id)
        .eq('status', 'pending');

      if (acceptedBidUpdateError) {
        throw acceptedBidUpdateError;
      }

      const { error: requestUpdateError } = await supabase
        .from('cargo_requests')
        .update({
          status: 'accepted',
          accepted_bid_id: bid.id,
          updated_at: nowIso,
        })
        .eq('id', id as string)
        .in('status', ['active', 'open']);

      if (requestUpdateError) {
        throw requestUpdateError;
      }

      const { data: otherPendingBids, error: otherPendingBidsError } = await supabase
        .from('bids')
        .select('id')
        .eq('request_id', id as string)
        .eq('status', 'pending')
        .neq('id', bid.id);

      if (otherPendingBidsError) {
        throw otherPendingBidsError;
      }

      const otherBidIds = (otherPendingBids || []).map(item => item.id);
      if (otherBidIds.length > 0) {
        const { error: rejectOthersError } = await supabase
          .from('bids')
          .update({
            status: 'rejected',
            updated_at: nowIso,
          })
          .in('id', otherBidIds);

        if (rejectOthersError) {
          throw rejectOthersError;
        }
      }

      // Track bid accepted
      trackBidAccepted({
        request_id: id as string,
        bid_id: bid.id,
        bid_amount: bid.price,
        carrier_id: bid.carrier_id,
      });

      // Create chat between customer and carrier
      try {
        if (request?.user_id && id) {
          console.log('Creating chat with:', {
            requestId: id,
            customerId: request.user_id,
            carrierId: bid.carrier_id,
            currentUserId: user?.uid,
          });

          const sorted = [request.user_id, bid.carrier_id].sort();
          const { error: chatUpsertError } = await supabase.from('chats').upsert(
            {
              request_id: id,
              user_a_id: sorted[0],
              user_b_id: sorted[1],
              last_message: null,
              last_message_at: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_a_id,user_b_id,request_id' }
          );

          if (chatUpsertError) {
            throw chatUpsertError;
          }
        }
      } catch (chatError) {
        console.error('⚠️ Error creating chat (non-critical):', chatError);
        // Don't fail the bid acceptance if chat creation fails
      }

      // Refresh bids
      fetchBids();
      fetchRequest();

      // Show success
      triggerHapticFeedback.success();
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
        Alert.alert(t('bidAccepted'), t('bidAcceptedNextStep'), [
          {
            text: t('proceedToPayment'),
            onPress: () => {
              navigateToPayment(bid);
            },
          },
        ]);
      }, 800);
    } catch (error) {
      console.error('Error accepting bid:', error);
      const errorMessage = error instanceof Error ? error.message : 'Kunne ikke godta bud';
      toast.error(errorMessage);
      triggerHapticFeedback.error();
    } finally {
      setAcceptingBid(null);
    }
  };

  const navigateToPayment = async (bid: Bid) => {
    try {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      if (!id || typeof id !== 'string') {
        throw new Error('Invalid request ID');
      }

      // Reuse existing order for this accepted bid if it already exists
      const { data: existingOrders, error: existingOrdersError } = await supabase
        .from('orders')
        .select('id')
        .eq('bid_id', bid.id)
        .limit(1);

      if (existingOrdersError) {
        throw existingOrdersError;
      }

      if (existingOrders && existingOrders.length > 0) {
        router.push(`/payment/${existingOrders[0].id}` as never);
        return;
      }

      const totalAmount = bid.price;
      const platformFee = Math.round(totalAmount * 0.1);
      const carrierAmount = totalAmount - platformFee;

      const nowIso = new Date().toISOString();
      const { data: orderRow, error: orderInsertError } = await supabase
        .from('orders')
        .insert({
          request_id: id,
          customer_id: user.uid,
          carrier_id: bid.carrier_id,
          bid_id: bid.id,
          total_amount: totalAmount,
          platform_fee: platformFee,
          carrier_amount: carrierAmount,
          payment_status: 'pending',
          status: 'active',
          created_at: nowIso,
          payment_initiated_at: nowIso,
        })
        .select('id')
        .single();

      if (orderInsertError || !orderRow) {
        throw orderInsertError || new Error('Failed to create order');
      }

      router.push(`/payment/${orderRow.id}` as never);
    } catch (error) {
      console.error('Navigation to payment error:', error);
      const errorMessage = error instanceof Error ? error.message : t('errorLoadingPayments');
      toast.error(errorMessage);
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
      // Delete all bids for this request
      const { data: requestBids, error: requestBidsError } = await supabase
        .from('bids')
        .select('id')
        .eq('request_id', id as string);

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
        .eq('id', id as string);

      if (deleteRequestError) {
        throw deleteRequestError;
      }

      // 📊 Track request deletion
      trackCargoRequestDeleted({
        request_id: id as string,
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
    return date.toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTimestamp = (timestamp: unknown) => {
    if (!timestamp) return '';
    const date =
      typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp
        ? (timestamp as { toDate: () => Date }).toDate()
        : new Date(timestamp as string);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('no-NO', { day: '2-digit', month: 'short' });
  };

  const isCustomer = request?.user_id === user?.uid;
  const canSubmitBid = !isCustomer && ['active', 'open'].includes(request?.status || '');
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
            <Text style={styles.description}>{request?.description}</Text>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Ionicons name="cube-outline" size={20} color={colors.primary} />
                <Text style={styles.infoLabel}>Type</Text>
                <Text style={styles.infoValue}>{t(request?.cargo_type || '')}</Text>
              </View>

              <View style={styles.infoItem}>
                <Ionicons name="scale-outline" size={20} color={colors.primary} />
                <Text style={styles.infoLabel}>Vekt</Text>
                <Text style={styles.infoValue}>{request?.weight} kg</Text>
              </View>

              {request?.dimensions && (
                <View style={styles.infoItem}>
                  <Ionicons name="resize-outline" size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Dimensjoner</Text>
                  <Text style={styles.infoValue}>{request.dimensions}</Text>
                </View>
              )}

              <View style={styles.infoItem}>
                <Ionicons name="cash-outline" size={20} color={colors.primary} />
                <Text style={styles.infoLabel}>Pris</Text>
                <Text style={styles.infoValue}>
                  {request?.price_type === 'negotiable'
                    ? 'Kan forhandles'
                    : `${request?.price} NOK`}
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
                  style={styles.map}
                  initialRegion={{
                    latitude: centerLat,
                    longitude: centerLng,
                    latitudeDelta: latDelta,
                    longitudeDelta: lngDelta,
                  }}
                >
                  <Marker
                    coordinate={{ latitude: fromLat, longitude: fromLng }}
                    title={t('pickup')}
                    description={request?.from_address || ''}
                    pinColor={colors.success}
                  />

                  <Marker
                    coordinate={{ latitude: toLat, longitude: toLng }}
                    title={t('to')}
                    description={request?.to_address || ''}
                    pinColor={colors.error}
                  />

                  <Polyline
                    coordinates={[
                      { latitude: fromLat, longitude: fromLng },
                      { latitude: toLat, longitude: toLng },
                    ]}
                    strokeColor={colors.primary}
                    strokeWidth={3}
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

      case 'bidForm':
        if (!canSubmitBid || hasBidFromUser) return null;
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Send bud</Text>

            <View style={styles.bidForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Budbeløp (NOK)</Text>
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
                accessibilityLabel={submittingBid ? 'Submitting bid' : 'Send bud'}
              >
                {submittingBid ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color={colors.white} />
                    <Text style={styles.submitButtonText}>Send bud</Text>
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
                    <Text style={styles.bidPrice}>{bid.price} NOK</Text>
                    <Text style={styles.bidDate}>{formatTimestamp(bid.created_at)}</Text>
                  </View>
                </View>

                {bid.message && <Text style={styles.bidMessage}>{bid.message}</Text>}

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
                        ? 'Godtatt'
                        : bid.status === 'rejected'
                          ? 'Avvist'
                          : 'Venter'}
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
                      accessibilityLabel={acceptingBid === bid.id ? 'Accepting bid' : 'Godta bud'}
                    >
                      {acceptingBid === bid.id ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.acceptButtonText}>Godta</Text>
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
        <Text style={styles.errorText}>Forespørsel ikke funnet</Text>
        <TouchableOpacity
          style={styles.errorButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Gå tilbake"
        >
          <Text style={styles.errorButtonText}>Gå tilbake</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sections = ['images', 'info', 'route', 'customer', 'bidForm', 'bids'];

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
                label: 'Edit request',
              }
            : undefined
        }
        rightAction={
          isCustomer
            ? {
                icon: 'trash-outline',
                onPress: handleDelete,
                label: deleting ? 'Deleting request' : 'Delete request',
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
