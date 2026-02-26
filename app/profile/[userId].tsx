import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../../components/ScreenHeader';
import { db } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { theme } from '../../theme/theme';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../lib/sharedStyles';

interface UserProfile {
  id: string;
  full_name: string;
  user_type: string;
  company_name?: string;
  rating: number;
  total_reviews: number;
  created_at: string;
  avatar_url?: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer: {
    full_name: string;
    user_type: string;
  };
  orders: {
    cargo_requests: {
      title: string;
    };
  };
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams();
  const { t } = useTranslation();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      const userRef = doc(db, 'users', userId as string);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error('User not found');
      }

      setProfile({ id: userSnap.id, ...userSnap.data() } as UserProfile);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchReviews = async () => {
    try {
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('reviewed_id', '==', userId),
        orderBy('created_at', 'desc'),
        limit(10)
      );

      const reviewsSnap = await getDocs(reviewsQuery);
      const reviewsData = await Promise.all(
        reviewsSnap.docs.map(async reviewDoc => {
          const reviewData = { id: reviewDoc.id, ...reviewDoc.data() } as Record<string, unknown>;
          const reviewerId =
            typeof reviewData.reviewer_id === 'string' ? reviewData.reviewer_id : undefined;
          const orderId = typeof reviewData.order_id === 'string' ? reviewData.order_id : undefined;

          const review: Review = {
            id: reviewDoc.id,
            rating: typeof reviewData.rating === 'number' ? reviewData.rating : 0,
            comment: typeof reviewData.comment === 'string' ? reviewData.comment : '',
            created_at:
              typeof reviewData.created_at === 'string'
                ? reviewData.created_at
                : new Date().toISOString(),
            reviewer: {
              full_name: 'Unknown User',
              user_type: 'private',
            },
            orders: {
              cargo_requests: {
                title: '',
              },
            },
          };

          // Fetch reviewer data
          if (reviewerId) {
            const reviewerRef = doc(db, 'users', reviewerId);
            const reviewerSnap = await getDoc(reviewerRef);
            if (reviewerSnap.exists()) {
              const reviewerData = reviewerSnap.data() as Record<string, unknown>;
              review.reviewer = {
                full_name:
                  typeof reviewerData.full_name === 'string'
                    ? reviewerData.full_name
                    : 'Unknown User',
                user_type:
                  typeof reviewerData.user_type === 'string' ? reviewerData.user_type : 'private',
              };
            }
          }

          // Fetch order and cargo request data
          if (orderId) {
            const orderRef = doc(db, 'orders', orderId);
            const orderSnap = await getDoc(orderRef);
            if (orderSnap.exists()) {
              const orderData = orderSnap.data() as Record<string, unknown>;
              const requestId =
                typeof orderData.request_id === 'string' ? orderData.request_id : undefined;
              if (requestId) {
                const requestRef = doc(db, 'cargo_requests', requestId);
                const requestSnap = await getDoc(requestRef);
                if (requestSnap.exists()) {
                  const requestData = requestSnap.data() as Record<string, unknown>;
                  review.orders = {
                    cargo_requests: {
                      title: typeof requestData.title === 'string' ? requestData.title : '',
                    },
                  };
                }
              }
            }
          }

          return review;
        })
      );

      setReviews(reviewsData);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, size: number = 16) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map(star => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color={star <= rating ? '#FCD34D' : '#D1D5DB'}
          />
        ))}
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.iconColors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="User Profile" onBackPress={() => router.back()} />

      <ScrollView style={styles.scrollView}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons
                  name={profile.user_type === 'business' ? 'business' : 'person'}
                  size={40}
                  color={theme.iconColors.primary}
                />
              </View>
            )}
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={16} color={theme.iconColors.white} />
            </View>
          </View>

          <Text style={styles.userName}>{profile.full_name}</Text>
          {profile.company_name && <Text style={styles.companyName}>{profile.company_name}</Text>}
          <Text style={styles.userType}>
            {profile.user_type === 'business' ? t('business') : t('private')}
          </Text>

          <View style={styles.ratingContainer}>
            {renderStars(Math.round(profile.rating), 20)}
            <Text style={styles.rating}>{profile.rating}</Text>
            <Text style={styles.reviewsCount}>
              ({profile.total_reviews} {t('reviews')})
            </Text>
          </View>
        </View>

        {/* Reviews Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Reviews ({reviews.length})</Text>

          {reviews.length === 0 ? (
            <Text style={styles.noReviewsText}>No reviews yet</Text>
          ) : (
            <View style={styles.reviewsList}>
              {reviews.map(review => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerInfo}>
                      <View style={styles.reviewerAvatar}>
                        <Ionicons
                          name={review.reviewer.user_type === 'business' ? 'business' : 'person'}
                          size={20}
                          color={theme.iconColors.primary}
                        />
                      </View>
                      <View>
                        <Text style={styles.reviewerName}>{review.reviewer.full_name}</Text>
                        <Text style={styles.reviewDate}>{formatDate(review.created_at)}</Text>
                      </View>
                    </View>
                    {renderStars(review.rating)}
                  </View>

                  {review.orders?.cargo_requests && (
                    <Text style={styles.orderTitle}>
                      Order: {review.orders.cargo_requests.title}
                    </Text>
                  )}

                  {review.comment && <Text style={styles.reviewComment}>{review.comment}</Text>}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Member Since */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('memberSince')} {new Date(profile.created_at).getFullYear()}
          </Text>
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
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.error,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: colors.white,
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  userName: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  companyName: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  userType: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'capitalize',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  rating: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  reviewsCount: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
  section: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  noReviewsText: {
    fontSize: fontSize.md,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  reviewsList: {
    gap: spacing.lg,
  },
  reviewCard: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  reviewerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  reviewDate: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  },
  orderTitle: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
  },
  reviewComment: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  footerText: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
});
