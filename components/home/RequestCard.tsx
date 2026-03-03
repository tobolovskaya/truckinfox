import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../lib/sharedStyles';
import {
  getCargoTypeColors,
  getCargoTypeIcon,
  REQUEST_CARD_IMAGE_HEIGHT,
} from '../../constants/cardStyles';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { useTranslation } from 'react-i18next';
import { LazyImage } from '../LazyImage';
import { LinearGradient } from 'expo-linear-gradient';

export interface CargoRequest {
  id: string;
  title?: string;
  description?: string;
  cargo_type?: string;
  weight?: number;
  from_address?: string;
  to_address?: string;
  pickup_date?: string;
  price?: number;
  price_type?: string;
  status?: string;
  created_at?: string;
  user_id?: string;
  customer_id?: string;
  distance?: number;
  images?: string[];
  bids?: Array<{ status?: string }>;
  users?: {
    full_name?: string;
  };
  is_favorite?: boolean;
}

interface RequestCardProps {
  request: CargoRequest;
  onPress: (_request: CargoRequest) => void;
  onToggleFavorite?: (_requestId: string) => void;
  showFavorite?: boolean;
  compact?: boolean;
  cardStyle?: StyleProp<ViewStyle>;
  currentUserId?: string;
}

export const RequestCard: React.FC<RequestCardProps> = ({
  request,
  onPress,
  onToggleFavorite,
  showFavorite = true,
  compact = false,
  cardStyle,
}) => {
  const { t } = useTranslation();
  const title = request.title || request.cargo_type || t('cargoRequest');
  const fromAddress = request.from_address || t('unknownPickup');
  const toAddress = request.to_address || t('unknownDelivery');
  const priceText =
    request.price_type === 'negotiable'
      ? t('negotiable')
      : typeof request.price === 'number' && request.price > 0
        ? formatCurrency(request.price)
        : t('priceOnAgreement');
  const dateText = request.pickup_date ? formatDate(request.pickup_date) : t('dateNotSet');
  const cargoType = request.cargo_type || 'other';
  const cargoTypeLabel = React.useMemo(() => t(cargoType), [cargoType, t]);
  const cargoColors = getCargoTypeColors(cargoType);
  const cargoIcon = getCargoTypeIcon(cargoType);
  const previewImageUri = React.useMemo(
    () => request.images?.find(image => typeof image === 'string' && image.trim().length > 0),
    [request.images]
  );

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact, cardStyle]}
      onPress={() => onPress(request)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${t('from')} ${fromAddress} ${t(
        'to'
      )} ${toAddress}. ${priceText}`}
      accessibilityHint={t('openRequestDetails')}
      accessible={true}
    >
      <LinearGradient
        colors={['#ffffff', '#fafafa']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {previewImageUri ? (
        <LazyImage
          uri={previewImageUri}
          style={styles.image}
          resizeMode="cover"
          showErrorText={false}
          fallback={
            <View style={[styles.imagePlaceholder, { backgroundColor: cargoColors.background }]}>
              <Ionicons name={cargoIcon} size={40} color={cargoColors.text} />
            </View>
          }
        />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: cargoColors.background }]}>
          <Ionicons name={cargoIcon} size={40} color={cargoColors.text} />
        </View>
      )}
      <View style={styles.contentWrap}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.price, compact && styles.priceCompact]}>{priceText}</Text>
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: cargoColors.background }]}>
            <Text style={[styles.badgeText, { color: cargoColors.text }]}>{cargoTypeLabel}</Text>
          </View>
        </View>

        <View style={styles.routeBlock}>
          <View style={styles.routeSection}>
            <View style={styles.routeLine}>
              <Ionicons name="radio-button-on" size={14} color={colors.primary} />
              <Text style={[styles.routeText, compact && styles.routeTextCompact]} numberOfLines={1}>
                {fromAddress}
              </Text>
            </View>
          </View>
          <View style={styles.routeSection}>
            <View style={styles.routeLine}>
              <Ionicons name="location-outline" size={14} color={colors.text.secondary} />
              <Text style={[styles.routeText, compact && styles.routeTextCompact]} numberOfLines={1}>
                {toAddress}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.metaText}>{dateText}</Text>
        {typeof request.distance === 'number' && request.distance > 0 && (
          <View style={styles.distanceBadge}>
            <Ionicons name="navigate-outline" size={12} color={colors.primary} />
            <Text style={styles.distanceBadgeText}>{Math.round(request.distance)} km</Text>
          </View>
        )}
        {showFavorite && onToggleFavorite && (
          <TouchableOpacity
            onPress={() => onToggleFavorite(request.id)}
            accessibilityRole="button"
            accessibilityLabel={
              request.is_favorite ? t('removeFromFavorites') : t('addToFavorites')
            }
            accessibilityHint={request.is_favorite ? t('removeFavoriteHint') : t('addFavoriteHint')}
            accessibilityState={{ selected: request.is_favorite }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={request.is_favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={request.is_favorite ? colors.error : colors.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    shadowColor: colors.primary, // Premium shadow
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden', // Contain gradient
  },
  cardCompact: {
  },
  image: {
    width: '100%',
    height: REQUEST_CARD_IMAGE_HEIGHT,
    backgroundColor: colors.border.light,
  },
  imagePlaceholder: {
    width: '100%',
    height: REQUEST_CARD_IMAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  titleCompact: {
    fontSize: fontSize.md,
  },
  price: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  priceCompact: {
    fontSize: fontSize.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  badge: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  badgeText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  routeBlock: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  routeSection: {
    gap: spacing.xxs,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  routeText: {
    flex: 1,
    flexWrap: 'wrap',
    fontSize: fontSize.md,
    color: colors.text.primary,
    fontWeight: fontWeight.semibold,
  },
  routeTextCompact: {
    fontSize: fontSize.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  metaText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    flexShrink: 1,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  distanceBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
});
