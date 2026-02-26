import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
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
import { db } from '../../lib/firebase';
import { triggerHapticFeedback } from '../../utils/haptics';
import { SuccessAnimation } from '../../components/SuccessAnimation';
import { LazyImage } from '../../components/LazyImage';
import Avatar from '../../components/Avatar';
import { ScreenHeader } from '../../components/ScreenHeader';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import {
  trackBidSubmitted,
  trackBidAccepted,
  trackCargoRequestDeleted,
} from '../../utils/analytics';
import { createChat } from '../../utils/chatManagement';
import { colors, spacing, fontSize, borderRadius } from '../../lib/sharedStyles';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { sanitizeMessage } from '../../utils/sanitization';

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
  from_lat?: number;
  from_lng?: number;
  to_lat?: number;
  to_lng?: number;
  distance_km?: number;
  pickup_date: string;
  delivery_date: string;
  price: number;
  price_type: string;
  status: string;
  user_id: string;
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
  const [bidMessage, setBidMessage] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [acceptingBid, setAcceptingBid] = useState<string | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const flatListRef = useRef(null);

  useEffect(() => {
    fetchRequest();
    fetchBids();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'cargo_requests', id as string);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        toast.error(t('failedToLoadRequest') || 'Request not found');
        triggerHapticFeedback.error();
        router.back();
        return;
      }

      const data = { id: docSnap.id, ...docSnap.data() } as CargoRequest;

      // Fetch customer info
      if (data.user_id) {
        const userRef = doc(db, 'users', data.user_id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          data.users = userSnap.data() as CargoRequest['users'];
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
      const bidsQuery = query(
        collection(db, 'bids'),
        where('request_id', '==', id),
        orderBy('created_at', 'desc')
      );

      const bidsSnap = await getDocs(bidsQuery);
      const bidsData = await Promise.all(
        bidsSnap.docs.map(async bidDoc => {
          const bidData = { id: bidDoc.id, ...bidDoc.data() } as Bid;

          // Fetch carrier user data
          if (bidData.carrier_id) {
            const carrierRef = doc(db, 'users', bidData.carrier_id);
            const carrierSnap = await getDoc(carrierRef);
            if (carrierSnap.exists()) {
              bidData.users = carrierSnap.data() as Bid['users'];
            }
          }

          return bidData;
        })
      );

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

      // 🔐 Sanitize bid message before sending
      const sanitizedMessage = bidMessage.trim() ? sanitizeMessage(bidMessage.trim(), 1000) : '';

      await addDoc(collection(db, 'bids'), {
        request_id: id,
        carrier_id: user.uid,
        price: amount,
        message: sanitizedMessage,
        status: 'pending',
        created_at: serverTimestamp(),
      });

      // Track bid submitted
      trackBidSubmitted({
        request_id: id as string,
        amount: amount,
        carrier_id: user.uid,
      });

      setBidAmount('');
      setBidMessage('');
      fetchBids();

      // Show success animation
      triggerHapticFeedback.success();
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
        toast.success(t('bidSubmitted') || 'Bid submitted successfully');
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
      // 🔒 Fetch all other pending bids OUTSIDE transaction (more reliable)
      const otherBidsQuery = query(
        collection(db, 'bids'),
        where('request_id', '==', id),
        where('status', '==', 'pending')
      );
      const otherBidsSnap = await getDocs(otherBidsQuery);
      const otherBidRefs = otherBidsSnap.docs
        .filter(bidDoc => bidDoc.id !== bid.id)
        .map(bidDoc => bidDoc.ref);

      // Use transaction for atomic operations
      await runTransaction(db, async transaction => {
        // 1. Verify bid is still pending
        const bidRef = doc(db, 'bids', bid.id);
        const bidDoc = await transaction.get(bidRef);

        if (!bidDoc.exists()) {
          throw new Error('Bud ikke funnet');
        }

        const bidData = bidDoc.data();
        if (bidData?.status !== 'pending') {
          throw new Error('Budet er ikke lenger tilgjengelig');
        }

        // 2. Verify request is still active
        const requestRef = doc(db, 'cargo_requests', id as string);
        const requestDoc = await transaction.get(requestRef);

        if (!requestDoc.exists()) {
          throw new Error('Forespørsel ikke funnet');
        }

        const requestData = requestDoc.data();
        if (requestData?.status !== 'active') {
          throw new Error('Forespørselen er ikke lenger aktiv');
        }

        // 3. Update bid status
        transaction.update(bidRef, {
          status: 'accepted',
          accepted_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });

        // 4. Update request status
        transaction.update(requestRef, {
          status: 'assigned',
          accepted_bid_id: bid.id,
          updated_at: serverTimestamp(),
        });

        // 5. 🔒 Reject other pending bids (atomic - using refs from before)
        otherBidRefs.forEach(otherBidRef => {
          transaction.update(otherBidRef, {
            status: 'rejected',
            rejected_at: serverTimestamp(),
            rejected_reason: 'Et annet bud ble godtatt',
            updated_at: serverTimestamp(),
          });
        });
      });

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
          await createChat(id as string, request.user_id, bid.carrier_id);
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
        Alert.alert(t('success'), t('bidAcceptedSuccess'), [
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
      const existingOrderQuery = query(collection(db, 'orders'), where('bid_id', '==', bid.id));
      const existingOrderSnap = await getDocs(existingOrderQuery);

      if (!existingOrderSnap.empty) {
        router.push(`/payment/${existingOrderSnap.docs[0].id}` as never);
        return;
      }

      const totalAmount = bid.price;
      const platformFee = Math.round(totalAmount * 0.1);
      const carrierAmount = totalAmount - platformFee;

      const orderRef = await addDoc(collection(db, 'orders'), {
        request_id: id,
        customer_id: user.uid,
        carrier_id: bid.carrier_id,
        bid_id: bid.id,
        total_amount: totalAmount,
        platform_fee: platformFee,
        carrier_amount: carrierAmount,
        payment_status: 'pending',
        status: 'active',
        created_at: serverTimestamp(),
        payment_initiated_at: serverTimestamp(),
      });

      await updateDoc(doc(db, 'bids', bid.id), {
        order_id: orderRef.id,
        updated_at: serverTimestamp(),
      });

      router.push(`/payment/${orderRef.id}` as never);
    } catch (error) {
      console.error('Navigation to payment error:', error);
      const errorMessage = error instanceof Error ? error.message : t('errorLoadingPayments');
      toast.error(errorMessage);
    }
  };

  const navigateToChat = () => {
    if (!request?.user_id) return;

    const otherUserId = request.user_id === user?.uid ? request.user_id : request.user_id;
    router.push(`/chat/${id}/${otherUserId}`);
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
    Alert.alert(
      t('confirmDelete') || 'Delete Request',
      t('confirmDeleteMessage') ||
        'Are you sure you want to delete this request? This action cannot be undone.',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    setDeleting(true);
    triggerHapticFeedback.medium();

    try {
      // Delete all bids for this request
      const bidsQuery = query(collection(db, 'bids'), where('request_id', '==', id));
      const bidsSnap = await getDocs(bidsQuery);
      const deletePromises = bidsSnap.docs.map(bidDoc => deleteDoc(bidDoc.ref));
      await Promise.all(deletePromises);

      // Delete the cargo request
      await deleteDoc(doc(db, 'cargo_requests', id as string));

      // 📊 Track request deletion
      trackCargoRequestDeleted({
        request_id: id as string,
        cargo_type: request?.cargo_type,
        had_bids: bidsSnap.size > 0,
        bid_count: bidsSnap.size,
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
    return date.toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTimestamp = (timestamp: unknown) => {
    if (!timestamp) return '';
    const date =
      typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp
        ? (timestamp as { toDate: () => Date }).toDate()
        : new Date(timestamp as string);
    return date.toLocaleDateString('no-NO', { day: '2-digit', month: 'short' });
  };

  const isCustomer = request?.user_id === user?.uid;
  const canSubmitBid = !isCustomer && request?.status === 'active';
  const hasBidFromUser = bids.some(bid => bid.carrier_id === user?.uid);

  const renderItem = ({ item }: { item: string; index: number }) => {
    switch (item) {
      case 'header':
        return null;

      case 'images':
        if (!request?.images || request.images.length === 0) return null;
        return (
          <View style={styles.imagesSection}>
            <View style={styles.imagesScroll}>
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
            </View>
          </View>
        );

      case 'info':
        return (
          <View style={styles.section}>
            <Text style={styles.title}>{request?.title}</Text>
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

      case 'route':
        // Show map if coordinates are available, otherwise show text addresses
        if (
          request?.from_lat != null &&
          request?.from_lng != null &&
          request?.to_lat != null &&
          request?.to_lng != null
        ) {
          // Calculate center point and initial region
          const centerLat = (request.from_lat + request.to_lat) / 2;
          const centerLng = (request.from_lng + request.to_lng) / 2;
          const latDelta = Math.max(Math.abs(request.from_lat - request.to_lat) * 1.5, 0.05);
          const lngDelta = Math.max(Math.abs(request.from_lng - request.to_lng) * 1.5, 0.05);

          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rute</Text>
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
                    coordinate={{ latitude: request.from_lat, longitude: request.from_lng }}
                    title={t('pickup')}
                    description={request.from_address}
                    pinColor="#4CAF50"
                  />

                  <Marker
                    coordinate={{ latitude: request.to_lat, longitude: request.to_lng }}
                    title={t('delivery') || 'Delivery'}
                    description={request.to_address}
                    pinColor="#FF7043"
                  />

                  <Polyline
                    coordinates={[
                      { latitude: request.from_lat, longitude: request.from_lng },
                      { latitude: request.to_lat, longitude: request.to_lng },
                    ]}
                    strokeColor="#FF7043"
                    strokeWidth={3}
                  />
                </MapView>

                {request?.distance_km != null && (
                  <View style={styles.distanceBadge}>
                    <Ionicons name="navigate-outline" size={16} color="#FFF" />
                    <Text style={styles.distanceBadgeText}>
                      {typeof request.distance_km === 'number'
                        ? request.distance_km.toFixed(0)
                        : request.distance_km}{' '}
                      km
                    </Text>
                  </View>
                )}
              </View>

              {/* Route info below map */}
              <View style={styles.routeInfoBox}>
                <View style={styles.routeInfoRow}>
                  <Ionicons name="location" size={18} color={colors.success} />
                  <View style={styles.routeInfoCol}>
                    <Text style={styles.routeLabel}>Fra</Text>
                    <Text style={styles.routeAddress}>{request.from_address}</Text>
                    <Text style={styles.routeDate}>{formatDate(request.pickup_date || '')}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.routeInfoRow}>
                  <Ionicons name="location" size={18} color={colors.error} />
                  <View style={styles.routeInfoCol}>
                    <Text style={styles.routeLabel}>Til</Text>
                    <Text style={styles.routeAddress}>{request.to_address}</Text>
                    <Text style={styles.routeDate}>{formatDate(request.delivery_date || '')}</Text>
                  </View>
                </View>
              </View>

              {request?.distance_km && (
                <View style={styles.distanceInfo}>
                  <Ionicons name="navigate-outline" size={16} color={colors.text.secondary} />
                  <Text style={styles.distanceText}>
                    {typeof request.distance_km === 'number' ? request.distance_km.toFixed(0) : '0'}{' '}
                    km
                  </Text>
                </View>
              )}
            </View>
          );
        } else {
          // Fallback to text view if no coordinates
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rute</Text>

              <View style={styles.routeRow}>
                <Ionicons name="location" size={24} color={colors.success} />
                <View style={styles.routeInfo}>
                  <Text style={styles.routeLabel}>Fra</Text>
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
                  <Text style={styles.routeLabel}>Til</Text>
                  <Text style={styles.routeAddress}>{request?.to_address}</Text>
                  <Text style={styles.routeDate}>{formatDate(request?.delivery_date || '')}</Text>
                </View>
              </View>

              {request?.distance_km && (
                <View style={styles.distanceInfo}>
                  <Ionicons name="navigate-outline" size={16} color={colors.text.secondary} />
                  <Text style={styles.distanceText}>
                    {typeof request.distance_km === 'number' ? request.distance_km.toFixed(0) : '0'}{' '}
                    km
                  </Text>
                </View>
              )}
            </View>
          );
        }

      case 'customer':
        if (!request?.users) return null;
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kunde</Text>

            <View style={styles.customerCard}>
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
              {!isCustomer && (
                <TouchableOpacity style={styles.chatButton} onPress={navigateToChat}>
                  <Ionicons name="chatbubble-outline" size={20} color={colors.white} />
                </TouchableOpacity>
              )}
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

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Melding (valgfritt)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bidMessage}
                  onChangeText={setBidMessage}
                  placeholder="Fortell hvorfor du er den rette for denne jobben..."
                  multiline
                  numberOfLines={3}
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Laster forespørsel...</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
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
    color: colors.text.tertiary,
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
  customerCard: {
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
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
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
    backgroundColor: '#FF7043',
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
