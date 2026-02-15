import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { trackBidSubmitted, trackBidAccepted } from '../../utils/analytics';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { theme } from '../../theme/theme';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../lib/sharedStyles';
import Avatar from '../../components/Avatar';
import { createChat, generateChatId } from '../../utils/chatManagement';
import { LazyImage } from '../../components/LazyImage';

interface CargoRequest {
  id: string;
  title: string;
  description: string;
  cargo_type: string;
  weight: number;
  dimensions: string;
  from_address: string;
  to_address: string;
  from_lat?: number;
  from_lng?: number;
  to_lat?: number;
  to_lng?: number;
  pickup_date: string;
  delivery_date: string;
  price: number;
  price_type: string;
  status: string;
  user_id: string;
  images?: string[];
  users: {
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
  created_at: string;
  carrier_id: string;
  users: {
    full_name: string;
    user_type: string;
    rating: number;
    phone: string;
    avatar_url?: string;
  };
}

interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewed_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer: {
    full_name: string;
    avatar_url?: string;
  };
}

export default function RequestDetailsScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [request, setRequest] = useState<CargoRequest | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [acceptingBid, setAcceptingBid] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);
  const mapRef = useRef<MapView>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userRating, setUserRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    fetchRequestDetails();
    fetchBids();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (request?.user_id) {
      fetchCustomerReviews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  useEffect(() => {
    if (request?.from_lat && request?.from_lng && request?.to_lat && request?.to_lng) {
      fetchRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const fetchRequestDetails = async () => {
    try {
      // Validate id parameter
      if (!id || typeof id !== 'string') {
        console.error('Invalid request ID:', id);
        Alert.alert(t('error'), t('invalidRequestId') || 'Invalid request ID');
        router.back();
        return;
      }

      const requestRef = doc(db, 'cargo_requests', id);
      const requestSnap = await getDoc(requestRef);

      if (!requestSnap.exists()) {
        console.error('Request not found. ID:', id);
        Alert.alert(
          t('error'),
          t('requestNotFound') || 'The requested cargo details could not be found.'
        );
        router.back();
        return;
      }

      const requestData = { id: requestSnap.id, ...requestSnap.data() } as any;

      // Fetch user data
      if (requestData.user_id) {
        const userRef = doc(db, 'users', requestData.user_id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          requestData.users = userSnap.data();
        }
      }

      setRequest(requestData);
    } catch (error) {
      console.error('Error fetching request details:', error);
      Alert.alert(
        t('error'),
        t('failedToLoadRequest') || 'Failed to load request details. Please try again.'
      );
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
          const bidData = { id: bidDoc.id, ...bidDoc.data() } as any;

          // Fetch carrier user data
          if (bidData.carrier_id) {
            const carrierRef = doc(db, 'users', bidData.carrier_id);
            const carrierSnap = await getDoc(carrierRef);
            if (carrierSnap.exists()) {
              bidData.users = carrierSnap.data();
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

  const fetchCustomerReviews = async () => {
    if (!request?.user_id) return;

    try {
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('reviewed_id', '==', request.user_id),
        orderBy('created_at', 'desc'),
        limit(2)
      );

      const reviewsSnap = await getDocs(reviewsQuery);
      const reviewsData = await Promise.all(
        reviewsSnap.docs.map(async reviewDoc => {
          const reviewData = { id: reviewDoc.id, ...reviewDoc.data() } as any;

          // Fetch reviewer data
          if (reviewData.reviewer_id) {
            const reviewerRef = doc(db, 'users', reviewData.reviewer_id);
            const reviewerSnap = await getDoc(reviewerRef);
            if (reviewerSnap.exists()) {
              reviewData.reviewer = reviewerSnap.data();
            }
          }

          return reviewData;
        })
      );

      setReviews(reviewsData as Review[]);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const fetchRoute = async () => {
    if (!request?.from_lat || !request?.from_lng || !request?.to_lat || !request?.to_lng) {
      console.log('Missing coordinates in request');
      return;
    }

    try {
      const fromLat = request.from_lat;
      const fromLng = request.from_lng;
      const toLat = request.to_lat;
      const toLng = request.to_lng;

      // Using Mapbox Directions API
      const accessToken =
        'pk.eyJ1IjoidG9ib2xvdnNrYXlhIiwiYSI6ImNtZzhhbG9obDA1NjMyanF3bXFvZW1sM20ifQ.SVl_KFz1bmhR405gUx6FrQ';
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?geometries=geojson&access_token=${accessToken}`;

      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
        },
        10000
      ); // 10 second timeout for Mapbox API
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const coordinates = data.routes[0].geometry.coordinates;
        // Convert [lng, lat] to {latitude, longitude}
        const routePoints = coordinates.map((coord: number[]) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));
        setRouteCoordinates(routePoints);

        // Fit map to show entire route
        setTimeout(() => {
          if (mapRef.current && routePoints.length > 0) {
            mapRef.current.fitToCoordinates(routePoints, {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: true,
            });
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      // Fallback to straight line if API fails
      if (request?.from_lat && request?.from_lng && request?.to_lat && request?.to_lng) {
        setRouteCoordinates([
          { latitude: request.from_lat, longitude: request.from_lng },
          { latitude: request.to_lat, longitude: request.to_lng },
        ]);
      }
    }
  };

  const submitBid = async () => {
    if (!bidAmount) {
      Alert.alert(t('error'), t('fillBidFields'));
      return;
    }

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert(t('error'), t('invalidBidAmount'));
      return;
    }

    setSubmittingBid(true);
    try {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      await addDoc(collection(db, 'bids'), {
        request_id: id,
        carrier_id: user.uid,
        price: amount,
        message: '',
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
      fetchBids();
      Alert.alert(t('success'), t('bidSubmitted'));
    } catch (error: any) {
      Alert.alert(t('error'), error.message);
    } finally {
      setSubmittingBid(false);
    }
  };

  const acceptBid = async (bid: Bid) => {
    Alert.alert(
      t('acceptBid'),
      t('acceptBidConfirmation', {
        amount: bid.price,
        carrier: bid.users.full_name,
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
    setAcceptingBid(bid.id);
    try {
      // 🔐 Use transaction for atomic operations to prevent race conditions
      await runTransaction(db, async transaction => {
        // 1. Verify bid is still pending
        const bidRef = doc(db, 'bids', bid.id);
        const bidDoc = await transaction.get(bidRef);

        if (!bidDoc.exists()) {
          throw new Error(t('bidNotFound') || 'Bid not found');
        }

        const bidData = bidDoc.data();
        if (bidData?.status !== 'pending') {
          throw new Error(t('bidNoLongerAvailable') || 'Bid is no longer available');
        }

        // 2. Verify request is still active
        const requestRef = doc(db, 'cargo_requests', id as string);
        const requestDoc = await transaction.get(requestRef);

        if (!requestDoc.exists()) {
          throw new Error(t('requestNotFound') || 'Request not found');
        }

        const requestData = requestDoc.data();
        if (requestData?.status !== 'active') {
          throw new Error(t('requestNoLongerActive') || 'Request is no longer active');
        }

        // 3. Atomic update: Accept this bid
        transaction.update(bidRef, {
          status: 'accepted',
          accepted_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });

        // 4. Atomic update: Update request status
        transaction.update(requestRef, {
          status: 'assigned',
          accepted_bid_id: bid.id,
          updated_at: serverTimestamp(),
        });

        // 5. Fetch and reject all other pending bids
        const otherBidsQuery = query(
          collection(db, 'bids'),
          where('request_id', '==', id),
          where('status', '==', 'pending')
        );
        const otherBidsSnap = await getDocs(otherBidsQuery);

        otherBidsSnap.docs.forEach(otherBidDoc => {
          if (otherBidDoc.id !== bid.id) {
            transaction.update(otherBidDoc.ref, {
              status: 'rejected',
              rejected_at: serverTimestamp(),
              rejected_reason: 'Another bid was accepted',
              updated_at: serverTimestamp(),
            });
          }
        });
      });

      // Track bid accepted (outside transaction)
      trackBidAccepted({
        request_id: id as string,
        bid_id: bid.id,
        bid_amount: bid.price,
        carrier_id: bid.carrier_id,
      });

      // Create chat between customer and carrier
      try {
        if (user?.uid && id) {
          const chatId = await createChat(
            id as string,
            user.uid, // customer_id
            bid.carrier_id // carrier_id
          );
          console.log('✅ Chat created successfully:', chatId);
        }
      } catch (chatError) {
        console.error('⚠️ Error creating chat (non-critical):', chatError);
        // Don't fail the bid acceptance if chat creation fails
      }

      // Refresh bids to show updated status
      fetchBids();

      Alert.alert(t('success'), t('bidAcceptedSuccess'), [
        {
          text: t('proceedToPayment'),
          onPress: () => navigateToPayment(bid),
        },
      ]);
    } catch (error: any) {
      Alert.alert(t('error'), error.message);
    } finally {
      setAcceptingBid(null);
    }
  };

  const navigateToPayment = async (bid: Bid) => {
    try {
      // Calculate platform fee (10%)
      const totalAmount = bid.price;
      const platformFee = Math.round(totalAmount * 0.1);
      const carrierAmount = totalAmount - platformFee;

      // Validate user data before creating order
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      // Get cargo request data for copying to order
      const cargoRef = doc(db, 'cargo_requests', id as string);
      const cargoSnap = await getDoc(cargoRef);

      if (!cargoSnap.exists()) {
        throw new Error('Cargo request not found');
      }

      const cargoData = cargoSnap.data();

      // Clean up any existing unpaid orders for this request
      // This prevents accumulation of abandoned payment sessions
      const existingOrdersQuery = query(
        collection(db, 'orders'),
        where('request_id', '==', id),
        where('payment_status', '==', 'pending')
      );
      const existingOrdersSnap = await getDocs(existingOrdersQuery);

      const batch = writeBatch(db);
      existingOrdersSnap.docs.forEach(orderDoc => {
        batch.delete(orderDoc.ref);
      });

      // If there were unpaid orders, commit the cleanup
      if (!existingOrdersSnap.empty) {
        await batch.commit();
        console.log(`Cleaned up ${existingOrdersSnap.size} unpaid order(s) for request ${id}`);
      }

      // Create order
      const orderRef = await addDoc(collection(db, 'orders'), {
        request_id: id,
        customer_id: user.uid,
        carrier_id: bid.carrier_id,
        bid_id: bid.id,
        from_address: cargoData?.from_address,
        to_address: cargoData?.to_address,
        cargo_title: cargoData?.title,
        cargo_type: cargoData?.cargo_type,
        total_amount: totalAmount,
        platform_fee: platformFee,
        carrier_amount: carrierAmount,
        payment_status: 'pending',
        status: 'active',
        created_at: serverTimestamp(),
        payment_initiated_at: serverTimestamp(), // Track when payment session started
      });

      // Update request status
      const requestRef = doc(db, 'cargo_requests', id as string);
      await updateDoc(requestRef, {
        status: 'in_progress',
        updated_at: serverTimestamp(),
      });

      // Navigate to payment screen
      router.push(`/payment/${orderRef.id}` as any);
    } catch (error: any) {
      console.error('Navigation to payment error:', error);
      Alert.alert(t('error'), error.message);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const openInMaps = () => {
    const fromAddress = encodeURIComponent(request?.from_address || '');
    const toAddress = encodeURIComponent(request?.to_address || '');

    let url = '';
    if (Platform.OS === 'ios') {
      url = `http://maps.apple.com/?saddr=${fromAddress}&daddr=${toAddress}`;
    } else {
      url = `geo:0,0?q=${fromAddress} to ${toAddress}`;
    }

    Linking.openURL(url).catch(err => {
      console.error('Error opening maps:', err);
      Alert.alert('Error', 'Could not open maps');
    });
  };

  const submitReview = async () => {
    if (userRating === 0) {
      Alert.alert('Feil', 'Velg en vurdering fra 1 til 5 stjerner');
      return;
    }

    if (!reviewComment.trim()) {
      Alert.alert('Feil', 'Skriv en kommentar');
      return;
    }

    try {
      // First, get the order_id associated with this request
      const ordersQuery = query(
        collection(db, 'orders'),
        where('request_id', '==', id),
        where('status', '==', 'delivered'),
        limit(1)
      );

      const ordersSnap = await getDocs(ordersQuery);

      if (ordersSnap.empty) {
        Alert.alert('Feil', 'Ingen fullført ordre funnet for denne forespørselen');
        return;
      }

      const orderDoc = ordersSnap.docs[0];

      await addDoc(collection(db, 'reviews'), {
        order_id: orderDoc.id,
        reviewer_id: user?.uid,
        reviewed_id: request?.user_id,
        rating: userRating,
        comment: reviewComment.trim(),
        created_at: serverTimestamp(),
      });

      setUserRating(0);
      setReviewComment('');
      fetchCustomerReviews();
      Alert.alert('Suksess', 'Vurderingen din er sendt');
    } catch (error: any) {
      console.error('Error submitting review:', error);
      Alert.alert('Feil', error.message);
    }
  };

  const isRequestOwner = request?.user_id === user?.uid;
  const canBid = !isRequestOwner && request?.status === 'active';
  // Note: Review form will check for delivered order when displaying
  const canLeaveReview =
    !isRequestOwner && (request?.status === 'completed' || request?.status === 'in_progress');

  const handleDeleteRequest = () => {
    Alert.alert(
      'Slett forespørsel',
      'Er du sikker på at du vil slette denne forespørselen? Dette kan ikke angres.',
      [
        {
          text: 'Avbryt',
          style: 'cancel',
        },
        {
          text: 'Slett',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Attempting to delete request:', id);
              console.log('Current user:', user?.uid);
              console.log('Request owner:', request?.user_id);

              // Delete from Firebase
              const requestRef = doc(db, 'cargo_requests', id as string);
              await deleteDoc(requestRef);

              // Show success and navigate back
              Alert.alert('Suksess', 'Forespørselen er slettet');
              router.back();
            } catch (error: any) {
              console.error('Delete error:', error);
              Alert.alert('Feil', 'Kunne ikke slette forespørselen');
            }
          },
        },
      ]
    );
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

  if (!request) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('requestNotFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.iconColors.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('requestDetails')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Bids Section - MOVED TO TOP (most important!) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('bids')} ({bids.length})
          </Text>

          {bids.length === 0 ? (
            <View style={styles.emptyBids}>
              <View style={styles.emptyBidsIconContainer}>
                <View style={styles.emptyBidsIconBackground}>
                  <Ionicons name="car-outline" size={48} color="#9CA3AF" />
                </View>
              </View>
              <Text style={styles.emptyBidsTitle}>Ingen bud ennå</Text>
              <Text style={styles.emptyBidsText}>
                Transportører vil se forespørselen din og gi tilbud snart
              </Text>

              {isRequestOwner && (
                <TouchableOpacity style={styles.boostButton}>
                  <Ionicons name="megaphone" size={18} color={colors.white} />
                  <Text style={styles.boostButtonText}>Boost synlighet</Text>
                  <View style={styles.premiumBadge}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.bidsList}>
              {bids.map(bid => (
                <View key={bid.id} style={styles.bidCard}>
                  <View style={styles.bidHeader}>
                    <View style={styles.bidCarrier}>
                      <Avatar
                        photoURL={bid.users.avatar_url}
                        size={42}
                        iconName={bid.users.user_type === 'business' ? 'business' : 'person'}
                      />
                      <View style={styles.bidCarrierInfo}>
                        <Text style={styles.bidCarrierName}>{bid.users.full_name}</Text>
                        <View style={styles.bidRating}>
                          <Ionicons name="star" size={14} color={theme.iconColors.rating} />
                          <Text style={styles.bidRatingText}>{bid.users.rating}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.bidPrice}>
                      <Text style={styles.bidAmount}>{bid.price} NOK</Text>
                      <Text style={styles.bidStatus}>{t(bid.status)}</Text>
                    </View>
                  </View>

                  <Text style={styles.bidMessage}>{bid.message}</Text>

                  {isRequestOwner && bid.status === 'pending' && request.status === 'active' && (
                    <TouchableOpacity
                      style={[
                        styles.acceptButton,
                        acceptingBid === bid.id && styles.acceptButtonDisabled,
                      ]}
                      onPress={() => acceptBid(bid)}
                      disabled={acceptingBid === bid.id}
                    >
                      {acceptingBid === bid.id ? (
                        <ActivityIndicator size="small" color={theme.iconColors.white} />
                      ) : (
                        <Text style={styles.acceptButtonText}>{t('acceptAndPay')}</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {isRequestOwner && bid.status === 'accepted' && (
                    <>
                      <TouchableOpacity
                        style={styles.paymentButton}
                        onPress={() => navigateToPayment(bid)}
                      >
                        <Ionicons name="card-outline" size={20} color={theme.iconColors.white} />
                        <Text style={styles.paymentButtonText}>{t('proceedToPayment')}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.messageButton}
                        onPress={() => {
                          const chatId = generateChatId(
                            id as string,
                            user?.uid || '',
                            bid.carrier_id
                          );
                          router.push(`/chat/${id}/${bid.carrier_id}` as any);
                        }}
                      >
                        <Ionicons
                          name="chatbubble-outline"
                          size={20}
                          color={theme.iconColors.primary}
                        />
                        <Text style={styles.messageButtonText}>
                          {t('messageCarrier') || 'Meld transportør'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {bid.status === 'accepted' && !isRequestOwner && (
                    <>
                      <View style={styles.acceptedBadge}>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={theme.iconColors.success}
                        />
                        <Text style={styles.acceptedText}>{t('bidAccepted')}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.messageButton}
                        onPress={() => {
                          const chatId = generateChatId(
                            id as string,
                            request?.user_id || '',
                            user?.uid || ''
                          );
                          router.push(`/chat/${id}/${request?.user_id}` as any);
                        }}
                      >
                        <Ionicons
                          name="chatbubble-outline"
                          size={20}
                          color={theme.iconColors.primary}
                        />
                        <Text style={styles.messageButtonText}>
                          {t('messageCustomer') || 'Meld kunde'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bid Form */}
        {canBid && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('submitBid')}</Text>

            <View style={styles.bidForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t('bidAmount')} (NOK)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={bidAmount}
                  onChangeText={setBidAmount}
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBidButton, submittingBid && styles.submitBidButtonDisabled]}
                onPress={submitBid}
                disabled={submittingBid}
              >
                {submittingBid ? (
                  <ActivityIndicator size="small" color={theme.iconColors.white} />
                ) : (
                  <Text style={styles.submitBidButtonText}>{t('submitBid')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Request Info (Cargo Details) */}
        <View style={styles.section}>
          {/* Title + Status */}
          <View style={styles.detailsHeaderRow}>
            <Text style={styles.requestTitle}>{request.title}</Text>
            <View
              style={[styles.statusBadge, request.status === 'active' && styles.statusBadgeActive]}
            >
              <Text style={styles.statusText}>
                {request.status === 'active' ? 'Aktiv forespørsel' : t(request.status)}
              </Text>
            </View>
          </View>

          {/* Image Gallery or Placeholder */}
          {request.images && request.images.length > 0 ? (
            <View style={styles.gallerySection}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={e => {
                  const index = Math.round(
                    e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width
                  );
                  setSelectedImageIndex(index);
                }}
                scrollEventThrottle={16}
              >
                {request.images.map((uri: string, index: number) => (
                  <LazyImage
                    key={index}
                    uri={uri}
                    style={styles.galleryImage}
                    containerStyle={styles.galleryImage}
                    resizeMode="cover"
                    placeholderIcon="image-outline"
                    placeholderSize={48}
                    showErrorText={true}
                  />
                ))}
              </ScrollView>

              {/* Indicators */}
              {request.images.length > 1 && (
                <View style={styles.indicators}>
                  {request.images.map((_: any, index: number) => (
                    <View
                      key={index}
                      style={[
                        styles.indicator,
                        index === selectedImageIndex && styles.indicatorActive,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noImages}>
              <View style={styles.noImagesIconContainer}>
                <Ionicons name="camera-outline" size={48} color="#9CA3AF" />
              </View>
              <Text style={styles.noImagesTitle}>Last opp bilde av lasten</Text>
              <Text style={styles.noImagesSubtitle}>
                Bilder hjelper transportører å forstå oppdraget bedre
              </Text>
            </View>
          )}

          {/* Category Badge */}
          <View style={styles.categoryBadgeRow}>
            <View style={styles.categoryBadgeWithIcon}>
              <Ionicons
                name={getCargoTypeIcon(request.cargo_type) as any}
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.categoryBadgeText}>{t(request.cargo_type).toUpperCase()}</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.description}>{request.description}</Text>

          {/* Characteristics */}
          <View style={styles.metaContainer}>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="barbell-outline" size={16} color={theme.iconColors.gray.primary} />
                <Text style={styles.metaText}>{request.weight} kg</Text>
              </View>
              <View style={styles.metaDivider} />
              {request.dimensions && (
                <>
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="resize-outline"
                      size={16}
                      color={theme.iconColors.gray.primary}
                    />
                    <Text style={styles.metaText}>{request.dimensions}</Text>
                  </View>
                  <View style={styles.metaDivider} />
                </>
              )}
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={16} color={theme.iconColors.gray.primary} />
                <Text style={styles.metaText}>{formatDate(request.pickup_date)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Customer Info - Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kunde</Text>
          <View style={styles.customerCard}>
            <View style={styles.customerCardContent}>
              <Avatar
                photoURL={request.users.avatar_url}
                size={56}
                iconName={request.users.user_type === 'business' ? 'business' : 'person'}
              />
              <View style={styles.customerInfo}>
                <View style={styles.customerNameRow}>
                  <Text style={styles.customerNameLarge}>{request.users.full_name}</Text>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={14} color={theme.iconColors.rating} />
                    <Text style={styles.ratingBadgeText}>{request.users.rating.toFixed(1)}</Text>
                  </View>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.viewProfileButton}
              onPress={() => router.push(`/profile/${request.user_id}` as any)}
            >
              <Text style={styles.viewProfileText}>Se profil ›</Text>
            </TouchableOpacity>

            {/* Reviews section */}
            {reviews.length > 0 && (
              <View style={styles.reviewsSection}>
                <Text style={styles.reviewsSectionTitle}>📝 Vurderinger:</Text>
                {reviews.map(review => (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewStars}>
                        {[...Array(5)].map((_, i) => (
                          <Ionicons
                            key={i}
                            name={i < review.rating ? 'star' : 'star-outline'}
                            size={12}
                            color={theme.iconColors.rating}
                          />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.reviewComment}>«{review.comment}»</Text>
                  </View>
                ))}
                <TouchableOpacity style={styles.viewAllReviewsButton}>
                  <Text style={styles.viewAllReviewsText}>Se alle vurderinger</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Review form for completed orders */}
            {canLeaveReview && (
              <View style={styles.reviewFormSection}>
                <Text style={styles.reviewFormTitle}>Legg igjen vurdering</Text>

                {/* Star rating */}
                <View style={styles.starRatingContainer}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setUserRating(star)}
                      style={styles.starButton}
                    >
                      <Ionicons
                        name={star <= userRating ? 'star' : 'star-outline'}
                        size={32}
                        color={star <= userRating ? theme.iconColors.rating : '#D1D5DB'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Comment input */}
                <TextInput
                  style={styles.reviewInput}
                  placeholder="Skriv en kommentar"
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  placeholderTextColor="#9CA3AF"
                />

                {/* Submit button */}
                <TouchableOpacity style={styles.submitReviewButton} onPress={submitReview}>
                  <Text style={styles.submitReviewButtonText}>Send vurdering</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Route */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('route')}</Text>

          {/* Map - Expandable */}
          <TouchableOpacity onPress={() => setMapExpanded(!mapExpanded)} activeOpacity={0.9}>
            <View style={[styles.mapContainer, mapExpanded && styles.mapExpanded]}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={
                  request?.from_lat && request?.from_lng && request?.to_lat && request?.to_lng
                    ? {
                        latitude: (request.from_lat + request.to_lat) / 2,
                        longitude: (request.from_lng + request.to_lng) / 2,
                        latitudeDelta: Math.abs(request.to_lat - request.from_lat) * 1.5,
                        longitudeDelta: Math.abs(request.to_lng - request.from_lng) * 1.5,
                      }
                    : {
                        latitude: 60.472,
                        longitude: 8.4689,
                        latitudeDelta: 15,
                        longitudeDelta: 15,
                      }
                }
                scrollEnabled={true}
                zoomEnabled={true}
                pitchEnabled={true}
                rotateEnabled={false}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={true}
                showsScale={false}
              >
                {/* Start Point */}
                {request?.from_lat && request?.from_lng && (
                  <Marker
                    coordinate={{ latitude: request.from_lat, longitude: request.from_lng }}
                    pinColor="#10B981"
                    title={request.from_address}
                  />
                )}

                {/* End Point */}
                {request?.to_lat && request?.to_lng && (
                  <Marker
                    coordinate={{ latitude: request.to_lat, longitude: request.to_lng }}
                    pinColor="#EF4444"
                    title={request.to_address}
                  />
                )}

                {/* Route Line */}
                {routeCoordinates.length > 0 && (
                  <Polyline
                    coordinates={routeCoordinates}
                    strokeColor="#FF7043"
                    strokeWidth={4}
                    strokeColors={['#FF7043']}
                    lineCap="round"
                    lineJoin="round"
                  />
                )}
              </MapView>
              <TouchableOpacity style={styles.openMapButton} onPress={openInMaps}>
                <Ionicons name="map-outline" size={16} color={colors.white} />
                <Text style={styles.openMapButtonText}>Åpne i kart</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          <View style={styles.routeContainer}>
            <View style={styles.routePoint}>
              <View style={styles.routeIconStart}>
                <Ionicons name="play" size={14} color={colors.white} />
              </View>
              <Text style={styles.routeText}>{request.from_address}</Text>
            </View>
            <View style={styles.routeArrow}>
              <Ionicons name="arrow-down" size={20} color="#9CA3AF" />
            </View>
            <View style={styles.routePoint}>
              <View style={styles.routeIconEnd}>
                <Ionicons name="flag" size={14} color={colors.white} />
              </View>
              <Text style={styles.routeText}>{request.to_address}</Text>
            </View>
          </View>
        </View>

        {/* Bottom padding for action bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Bar - Only for request owner */}
      {isRequestOwner && request.status === 'active' && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.editButtonBottom}
            onPress={() => router.push(`/edit-request/${id}`)}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
            <Text style={styles.editButtonText}>Rediger forespørsel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteRequest}>
            <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#616161',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#212121',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  detailsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  categoryBadgeRow: {
    marginTop: 16,
    marginBottom: 12,
  },
  categoryBadgeWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9CA3AF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statusBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadgeActive: {
    backgroundColor: '#FF7043',
    shadowColor: '#FF7043',
  },
  statusText: {
    fontSize: 13,
    color: 'white',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  requestTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#212121',
    marginBottom: 0,
    flex: 1,
    marginRight: 12,
  },
  description: {
    fontSize: 16,
    color: '#616161',
    lineHeight: 24,
    marginBottom: 18,
  },
  metaContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  metaDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#D1D5DB',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 16,
  },
  routeContainer: {
    paddingVertical: 8,
  },
  mapContainer: {
    height: 380,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mapExpanded: {
    height: 600,
  },
  openMapButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF8A65',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#FF8A65',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  openMapButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  routeIconStart: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  routeIconEnd: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  routeText: {
    fontSize: 15,
    color: '#212121',
    marginLeft: 12,
    flex: 1,
    fontWeight: '500',
  },
  routeArrow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  customerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  customerCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  customerInfo: {
    flex: 1,
  },
  customerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  customerNameLarge: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingBadgeText: {
    fontSize: 14,
    color: '#212121',
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#616161',
    marginLeft: 6,
    fontWeight: '600',
  },
  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  viewProfileText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.iconColors.primary,
  },
  reviewsSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  reviewsSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  reviewItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: '#616161',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  viewAllReviewsButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.iconColors.primary,
    alignItems: 'center',
  },
  viewAllReviewsText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.iconColors.primary,
  },
  reviewFormSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  reviewFormTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 12,
  },
  starRatingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    paddingVertical: 8,
  },
  starButton: {
    padding: 4,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#212121',
    backgroundColor: colors.white,
    minHeight: 80,
    marginBottom: 12,
  },
  submitReviewButton: {
    backgroundColor: '#FF7043',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7043',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  submitReviewButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBids: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyBidsIconContainer: {
    marginBottom: 20,
  },
  emptyBidsIconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyBidsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 10,
  },
  emptyBidsText: {
    fontSize: 15,
    color: '#616161',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 280,
  },
  boostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#FF7043',
    marginTop: 16,
    shadowColor: '#FF7043',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  boostButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  premiumBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  gallerySection: {
    marginVertical: 16,
    height: 250,
  },
  galleryImage: {
    width: 350,
    height: 250,
    borderRadius: 12,
    marginRight: 12,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.text.tertiary,
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  indicatorActive: {
    backgroundColor: '#FF7043',
    width: 20,
  },
  noImages: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    marginVertical: 16,
    paddingHorizontal: 32,
  },
  noImagesIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noImagesTitle: {
    fontSize: 16,
    color: '#212121',
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  noImagesSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  bidsList: {
    gap: 16,
  },
  bidCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 2,
  },
  bidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bidCarrier: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  bidCarrierInfo: {
    flex: 1,
  },
  bidCarrierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  bidRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD9CC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF7043',
  },
  bidRatingText: {
    fontSize: 12,
    color: '#616161',
    marginLeft: 4,
  },
  bidPrice: {
    alignItems: 'flex-end',
  },
  bidAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  bidStatus: {
    fontSize: 12,
    color: '#616161',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  bidMessage: {
    fontSize: 14,
    color: '#616161',
    lineHeight: 20,
    marginBottom: 12,
  },
  acceptButton: {
    backgroundColor: '#FF7043',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF7043',
    borderRadius: 20,
    paddingVertical: 14,
    marginTop: 8,
  },
  paymentButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#FF7043',
    borderRadius: 20,
    paddingVertical: 14,
    marginTop: 8,
  },
  messageButtonText: {
    color: '#FF7043',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  acceptedText: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bidForm: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#212121',
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitBidButton: {
    backgroundColor: '#FF7043',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBidButtonDisabled: {
    opacity: 0.6,
  },
  submitBidButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  editButtonBottom: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFF5F2',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  deleteButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
