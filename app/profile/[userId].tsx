import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SkeletonLoader } from '../../components/SkeletonLoader';
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

const isBusinessUserType = (userType?: string) => userType === 'carrier' || userType === 'business';

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
    const loadData = async () => {
      await Promise.all([fetchProfile(), fetchReviews()]);
      setLoading(false);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfile = async () => {
    try {
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID');
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, company_name, rating, created_at, avatar_url')
        .eq('id', userId)
        .single();

      if (error || !data) {
        throw new Error('User not found');
      }

      setProfile({
        id: data.id,
        full_name: data.full_name || '',
        user_type: data.user_type || 'customer',
        company_name: data.company_name || undefined,
        rating: Number(data.rating || 0),
        total_reviews: 0,
        created_at: data.created_at || new Date().toISOString(),
        avatar_url: data.avatar_url || undefined,
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchReviews = async () => {
    try {
      if (!userId || typeof userId !== 'string') {
        return;
      }

      const { data: reviewsRows, error: reviewsError } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, reviewer_id, order_id')
        .eq('reviewed_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (reviewsError) {
        throw reviewsError;
      }

      const rows = reviewsRows || [];
      const reviewerIds = Array.from(
        new Set(rows.map(row => row.reviewer_id).filter((value): value is string => Boolean(value)))
      );
      const orderIds = Array.from(
        new Set(rows.map(row => row.order_id).filter((value): value is string => Boolean(value)))
      );

      const [{ data: reviewersData }, { data: ordersData }] = await Promise.all([
        reviewerIds.length
          ? supabase.from('profiles').select('id, full_name, user_type').in('id', reviewerIds)
          : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; user_type: string | null }> }),
        orderIds.length
          ? supabase.from('orders').select('id, request_id').in('id', orderIds)
          : Promise.resolve({ data: [] as Array<{ id: string; request_id: string | null }> }),
      ]);

      const requestIds = Array.from(
        new Set((ordersData || []).map(orderRow => orderRow.request_id).filter((value): value is string => Boolean(value)))
      );

      const { data: requestsData } = requestIds.length
        ? await supabase.from('cargo_requests').select('id, title').in('id', requestIds)
        : { data: [] as Array<{ id: string; title: string | null }> };

      const reviewerById = new Map(
        (reviewersData || []).map(item => [item.id, item])
      );
      const orderById = new Map((ordersData || []).map(item => [item.id, item]));
      const requestById = new Map((requestsData || []).map(item => [item.id, item]));

      const reviewsData: Review[] = rows.map(row => {
        const reviewer = row.reviewer_id ? reviewerById.get(row.reviewer_id) : undefined;
        const orderRow = row.order_id ? orderById.get(row.order_id) : undefined;
        const request = orderRow?.request_id ? requestById.get(orderRow.request_id) : undefined;

        return {
          id: row.id,
          rating: Number(row.rating || 0),
          comment: row.comment || '',
          created_at: row.created_at || new Date().toISOString(),
          reviewer: {
            full_name: reviewer?.full_name || 'Unknown User',
            user_type: reviewer?.user_type || 'private',
          },
          orders: {
            cargo_requests: {
              title: request?.title || '',
            },
          },
        };
      });

      setReviews(reviewsData);
      setProfile(prev =>
        prev
          ? {
              ...prev,
              total_reviews: reviewsData.length,
            }
          : prev
      );
    } catch (error) {
      console.error('Error fetching reviews:', error);
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
        <ScreenHeader title="User Profile" onBackPress={() => router.back()} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.profileSkeletonContent}>
          <View style={styles.profileSkeletonBlock}>
            <SkeletonLoader variant="text" count={1} />
          </View>
          <View style={styles.profileSkeletonBlock}>
            <SkeletonLoader variant="stats" count={1} />
          </View>
          <View style={styles.profileSkeletonBlock}>
            <SkeletonLoader variant="list" count={3} />
          </View>
        </ScrollView>
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
                  name={isBusinessUserType(profile.user_type) ? 'business' : 'person'}
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
            {isBusinessUserType(profile.user_type) ? t('business') : t('private')}
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
                          name={isBusinessUserType(review.reviewer.user_type) ? 'business' : 'person'}
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
  profileSkeletonContent: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  profileSkeletonBlock: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
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
