import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../../lib/sharedStyles';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { LazyImage } from '../LazyImage';

interface CargoRequest {
  id: string;
  title: string;
  description: string;
  cargo_type: string;
  weight: number;
  dimensions?: string;
  from_address: string;
  to_address: string;
  pickup_date: string;
  delivery_date?: string;
  price: number;
  price_type: string;
  status: string;
  created_at: string;
  user_id: string;
  distance?: number;
  users: {
    full_name: string;
    user_type: string;
    rating: number;
    avatar_url?: string;
  };
  bids: any[];
  is_favorite?: boolean;
  user_favorites?: { id: string; user_id: string }[];
  images?: string[];
}

interface RequestCardProps {
  request: CargoRequest;
  onPress: (request: CargoRequest) => void;
  onToggleFavorite: (requestId: string) => void;
}

const getCategoryIcon = (type: string) => {
  const icons: { [key: string]: string } = {
    furniture: 'bed-outline',
    electronics: 'phone-portrait-outline',
    food: 'restaurant-outline',
    clothing: 'shirt-outline',
    construction: 'construct-outline',
    automotive: 'car-outline',
    boats: 'boat-outline',
    campingvogn: 'home-outline',
    machinery: 'build-outline',
    transport: 'car-outline',
    moving: 'cube-outline',
    appliances: 'home-outline',
    books: 'library-outline',
    sports: 'football-outline',
    music: 'musical-notes-outline',
    art: 'color-palette-outline',
    plants: 'leaf-outline',
    tools: 'hammer-outline',
    other: 'cube-outline',
  };
  return icons[type] || 'cube-outline';
};

const formatPrice = (price: number, priceType: string, t: any) => {
  if (priceType === 'negotiable') return t('negotiable') || 'Negotiable';
  if (priceType === 'auction') return t('auction') || 'Auction';
  return `${price} NOK`;
};

export const RequestCard = React.memo<RequestCardProps>(({ request, onPress, onToggleFavorite }) => {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const heartScale = useSharedValue(1);
  const heartOpacity = useSharedValue(request.is_favorite ? 1 : 0);

  const animatedHeartStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: heartScale.value }],
    };
  });

  const animatedHeartFillStyle = useAnimatedStyle(() => {
    return {
      opacity: heartOpacity.value,
    };
  });

  const animateHeart = () => {
    if (reduceMotion) {
      // Instant transition for accessibility
      heartOpacity.value = request.is_favorite ? 0 : 1;
      return;
    }

    // Smooth color fill animation
    if (!request.is_favorite) {
      heartOpacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.quad),
      });
    } else {
      heartOpacity.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.quad),
      });
    }

    // Scale animation - more subtle
    heartScale.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withSpring(1.1, {
        damping: 20,
        stiffness: 400,
        mass: 0.8
      }),
      withSpring(1, {
        damping: 15,
        stiffness: 300,
      })
    );
  };

  const handleFavoritePress = (e: any) => {
    e.stopPropagation();
    animateHeart();
    onToggleFavorite(request.id);
  };

  return (
    <TouchableOpacity
      onPress={() => onPress(request)}
      activeOpacity={0.7}
      style={styles.finnStyleCard}
    >
      {/* Photo Section with Overlays */}
      <View style={styles.photoSection}>
        {request.images && request.images.length > 0 ? (
          <LazyImage
            uri={request.images[0]}
            style={styles.cardPhoto}
            containerStyle={styles.cardPhoto}
            resizeMode="cover"
            placeholderIcon={getCategoryIcon(request.cargo_type) as any}
            placeholderSize={48}
            showErrorText={false}
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <View style={styles.placeholderIconContainer}>
              <Ionicons
                name={getCategoryIcon(request.cargo_type) as any}
                size={36}
                color="#9E9E9E"
              />
            </View>
          </View>
        )}

        {/* Heart Button - Top Right */}
        <TouchableOpacity
          onPress={handleFavoritePress}
          activeOpacity={0.7}
          style={styles.heartButtonOverlay}
        >
          <Reanimated.View style={animatedHeartStyle}>
            <Ionicons
              name="heart-outline"
              size={20}
              color="#374151"
            />
            <Reanimated.View style={[{ position: 'absolute' }, animatedHeartFillStyle]}>
              <Ionicons
                name="heart"
                size={20}
                color="#EF4444"
              />
            </Reanimated.View>
          </Reanimated.View>
        </TouchableOpacity>

        {/* Price Badge - Bottom Left */}
        <View style={styles.priceBadgeOverlay}>
          <Text style={styles.priceBadgeText}>
            {formatPrice(request.price, request.price_type, t)}
          </Text>
        </View>
      </View>

      {/* Content Below Photo */}
      <View style={styles.cardContentBelow}>
        {/* Title */}
        <Text style={styles.finnTitle} numberOfLines={2}>
          {request.title}
        </Text>

        {/* Category */}
        <View style={styles.categoryRow}>
          <Ionicons
            name={getCategoryIcon(request.cargo_type) as any}
            size={14}
            color={colors.text.secondary}
          />
          <Text style={styles.categoryText}>{t(request.cargo_type) || request.cargo_type}</Text>
        </View>

        {/* Route */}
        <View style={styles.routeFinn}>
          <Ionicons name="location" size={14} color="#616161" />
          <Text style={styles.routeTextFinn} numberOfLines={1}>
            {request.from_address.split(',')[0]} → {request.to_address.split(',')[0]}
          </Text>
          {request.distance && (
            <Text style={styles.distanceTextFinn}>({Math.round(request.distance)} km)</Text>
          )}
        </View>

        {/* Meta Info */}
        <View style={styles.metaFinn}>
          <Text style={styles.metaTextFinn}>
            {request.weight} kg • {new Date(request.pickup_date).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

RequestCard.displayName = 'RequestCard';

const styles = StyleSheet.create({
  finnStyleCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    ...shadows.sm,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.badge?.background || '#E5E7EB',
    flex: 1,
  },
  photoSection: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: colors.background,
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIconContainer: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heartButtonOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priceBadgeOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    ...shadows.sm,
    elevation: 3,
  },
  priceBadgeText: {
    color: '#212121',
    fontSize: 16,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  cardContentBelow: {
    padding: spacing.sm,
  },
  finnTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  categoryText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  routeFinn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: 4,
  },
  routeTextFinn: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  distanceTextFinn: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  metaFinn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaTextFinn: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
});
