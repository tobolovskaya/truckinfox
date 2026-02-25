import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenSection } from '../../components/ScreenSection';
import { theme } from '../../theme/theme';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../lib/sharedStyles';
import { sanitizeMessage } from '../../utils/sanitization';
import { trackReviewSubmitted } from '../../utils/analytics';

interface Order {
  id: string;
  customer_id: string;
  carrier_id: string;
  request_id?: string;
  status: string;
  cargo_requests: {
    title: string;
  };
  customer: {
    full_name: string;
  };
  carrier: {
    full_name: string;
  };
}

export default function ReviewScreen() {
  const { orderId } = useLocalSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const fetchOrder = useCallback(async () => {
    try {
      if (!orderId || typeof orderId !== 'string') {
        throw new Error('Invalid order ID');
      }

      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        throw new Error('Order not found');
      }

      const orderData: Order = {
        id: orderSnap.id,
        ...(orderSnap.data() as Omit<Order, 'id'>),
      };

      // Fetch cargo request data
      if (orderData.request_id) {
        const requestRef = doc(db, 'cargo_requests', orderData.request_id);
        const requestSnap = await getDoc(requestRef);
        if (requestSnap.exists()) {
          orderData.cargo_requests = requestSnap.data() as Order['cargo_requests'];
        }
      }

      // Fetch customer data
      if (orderData.customer_id) {
        const customerRef = doc(db, 'users', orderData.customer_id);
        const customerSnap = await getDoc(customerRef);
        if (customerSnap.exists()) {
          orderData.customer = customerSnap.data() as Order['customer'];
        }
      }

      // Fetch carrier data
      if (orderData.carrier_id) {
        const carrierRef = doc(db, 'users', orderData.carrier_id);
        const carrierSnap = await getDoc(carrierRef);
        if (carrierSnap.exists()) {
          orderData.carrier = carrierSnap.data() as Order['carrier'];
        }
      }

      setOrder(orderData);
    } catch (error: unknown) {
      console.error('Error fetching order:', error);
      const message = error instanceof Error ? error.message : 'Failed to load order details';
      Alert.alert(t('error'), message);
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const submitReview = async () => {
    if (rating === 0) {
      Alert.alert(t('error'), 'Please select a rating');
      return;
    }

    if (!order) return;

    setSubmitting(true);
    try {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      // Determine who is being reviewed
      const isCustomer = order.customer_id === user.uid;
      const reviewedId = isCustomer ? order.carrier_id : order.customer_id;

      // Create the review
      await addDoc(collection(db, 'reviews'), {
        order_id: orderId,
        reviewer_id: user.uid,
        reviewed_id: reviewedId,
        rating: rating,
        comment: comment.trim() ? sanitizeMessage(comment.trim(), 1000) : null,
        created_at: serverTimestamp(),
      });

      // Update user rating
      // Fetch all reviews for the reviewed user to calculate average
      const reviewsQuery = query(collection(db, 'reviews'), where('reviewed_id', '==', reviewedId));
      const reviewsSnap = await getDocs(reviewsQuery);

      // Calculate average rating
      const totalRating = reviewsSnap.docs.reduce((sum, doc) => sum + (doc.data().rating || 0), 0);
      const avgRating = reviewsSnap.size > 0 ? totalRating / reviewsSnap.size : 0;

      // Update user document with new rating
      await updateDoc(doc(db, 'users', reviewedId), {
        rating: Number(avgRating.toFixed(2)), // Round to 2 decimal places
        total_reviews: reviewsSnap.size,
        updated_at: serverTimestamp(),
      });

      console.log(
        `Updated rating for user ${reviewedId}: ${avgRating.toFixed(2)} (${reviewsSnap.size} reviews)`
      );

      // 📊 Track review submission
      trackReviewSubmitted({
        order_id: orderId as string,
        rating: rating,
        has_comment: !!comment.trim(),
      });

      Alert.alert(t('success'), 'Review submitted successfully!', [
        {
          text: t('ok'),
          onPress: () => router.back(),
        },
      ]);
    } catch (error: unknown) {
      console.error('Error submitting review:', error);
      const message = error instanceof Error ? error.message : t('error');
      Alert.alert(t('error'), message);
    } finally {
      setSubmitting(false);
    }
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
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCustomer = order.customer_id === user?.uid;
  const reviewedPerson = isCustomer ? order.carrier.full_name : order.customer.full_name;
  const reviewedRole = isCustomer ? t('carrier') : t('customer');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Leave Review" showBackButton />

      <ScrollView style={styles.scrollView}>
        {/* Order Info */}
        <ScreenSection title="Order Details">
          <Text style={styles.orderTitle}>{order.cargo_requests.title}</Text>
          <Text style={styles.orderStatus}>Status: {t(order.status)}</Text>
        </ScreenSection>

        {/* Review Target */}
        <ScreenSection title={`Rate your experience with ${reviewedRole}`}>
          <View style={styles.reviewTarget}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color={theme.iconColors.primary} />
            </View>
            <Text style={styles.reviewedName}>{reviewedPerson}</Text>
          </View>
        </ScreenSection>

        {/* Rating */}
        <ScreenSection title="Rating *">
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                style={styles.starButton}
                onPress={() => setRating(star)}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={40}
                  color={star <= rating ? '#FCD34D' : '#D1D5DB'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingText}>
            {rating === 0 && 'Select a rating'}
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Fair'}
            {rating === 3 && 'Good'}
            {rating === 4 && 'Very Good'}
            {rating === 5 && 'Excellent'}
          </Text>
        </ScreenSection>

        {/* Comment */}
        <ScreenSection title="Comment (Optional)">
          <TextInput
            style={styles.commentInput}
            placeholder="Share your experience..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
            placeholderTextColor="#9CA3AF"
          />
          <Text style={styles.characterCount}>{comment.length}/500 characters</Text>
        </ScreenSection>

        {/* Submit Button */}
        <ScreenSection>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (rating === 0 || submitting) && styles.submitButtonDisabled,
            ]}
            onPress={submitReview}
            disabled={rating === 0 || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={theme.iconColors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Submit Review</Text>
            )}
          </TouchableOpacity>
        </ScreenSection>
      </ScrollView>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
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
    marginBottom: spacing.sm,
  },
  orderStatus: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  reviewTarget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  reviewedName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  starButton: {
    padding: spacing.sm,
  },
  ratingText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    textAlign: 'center',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text.primary,
    backgroundColor: colors.white,
    minHeight: 100,
  },
  characterCount: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
});
