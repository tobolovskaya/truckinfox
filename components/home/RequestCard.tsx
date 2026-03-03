import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../lib/sharedStyles';
import {
  getCargoTypeColors,
  getCargoTypeIcon,
  REQUEST_CARD_IMAGE_HEIGHT,
} from '../../constants/cardStyles';
import { formatCurrency, formatDate } from '../../utils/formatting';
import { useTranslation } from 'react-i18next';
import { LazyImage } from '../LazyImage';

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
  bid_count?: number;
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
  const rawTitle = request.title || request.cargo_type || t('cargoRequest');
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const fromAddress = request.from_address || t('unknownPickup');
  const toAddress = request.to_address || t('unknownDelivery');
  const priceText =
    request.price_type === 'negotiable'
      ? t('negotiable')
      : typeof request.price === 'number' && request.price > 0
        ? formatCurrency(request.price)
        : t('priceOnAgreement');
  const compactPriceText =
    request.price_type === 'negotiable'
      ? t('negotiable')
      : typeof request.price === 'number' && request.price > 0
        ? `${Math.round(request.price)} kr`
        : t('priceOnAgreement');
  const priceTextNoWrap = React.useMemo(
    () => (compact ? compactPriceText : priceText).replace(/\s+/g, '\u00A0'),
    [compact, compactPriceText, priceText]
  );
  const dateText = request.pickup_date ? formatDate(request.pickup_date) : t('dateNotSet');
  const cargoType = request.cargo_type || 'other';
  const cargoColors = getCargoTypeColors(cargoType);
  const cargoIcon = getCargoTypeIcon(cargoType);
  const previewImageUri = React.useMemo(
    () => request.images?.find(image => typeof image === 'string' && image.trim().length > 0),
    [request.images]
  );
  const bidCount =
    typeof request.bid_count === 'number' && Number.isFinite(request.bid_count)
      ? Math.max(0, Math.round(request.bid_count))
      : Array.isArray(request.bids)
        ? request.bids.length
        : 0;

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
      <View style={styles.imageContainer}>
        {previewImageUri ? (
          <LazyImage
            uri={previewImageUri}
            style={[styles.image, compact && styles.imageCompact]}
            resizeMode="cover"
            showErrorText={false}
            fallback={
              <View
                style={[
                  styles.imagePlaceholder,
                  compact && styles.imagePlaceholderCompact,
                  { backgroundColor: cargoColors.background },
                ]}
              >
                <Ionicons name={cargoIcon} size={40} color={cargoColors.text} />
              </View>
            }
          />
        ) : (
          <View
            style={[
              styles.imagePlaceholder,
              compact && styles.imagePlaceholderCompact,
              { backgroundColor: cargoColors.background },
            ]}
          >
            <Ionicons name={cargoIcon} size={40} color={cargoColors.text} />
          </View>
        )}
        <View style={[styles.priceOverlayFloating, compact && styles.priceOverlayFloatingCompact]}>
          <View style={[styles.priceOverlayBadgeFloating, compact && styles.priceOverlayBadgeFloatingCompact]}>
            <Text
              style={[styles.priceOverlayTextFloating, compact && styles.priceOverlayTextFloatingCompact]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {priceTextNoWrap}
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.contentWrap, compact && styles.contentWrapCompact]}>
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
          {title}
        </Text>

        <View style={[styles.routeBlock, compact && styles.routeBlockCompact]}>
          <View style={[styles.routeLine, compact && styles.routeLineCompact]}>
            <Ionicons name="radio-button-on" size={compact ? 11 : 13} color={colors.primary} />
            <Text style={[styles.routeText, compact && styles.routeTextCompact]} numberOfLines={1}>
              {fromAddress}
            </Text>
          </View>
          <View style={[styles.routeLine, compact && styles.routeLineCompact]}>
            <Ionicons
              name="location-outline"
              size={compact ? 11 : 13}
              color={colors.text.secondary}
            />
            <Text style={[styles.routeText, compact && styles.routeTextCompact]} numberOfLines={1}>
              {toAddress}
            </Text>
          </View>
        </View>

        <View style={[styles.footerRow, compact && styles.footerRowCompact]}>
          <View style={styles.dateRow}>
            <Text style={[styles.metaText, compact && styles.metaTextCompact]}>{dateText}</Text>
          </View>
          <View style={styles.footerActions}>
            {bidCount > 0 && (
              <View style={[styles.bidCountBadge, compact && styles.bidCountBadgeCompact]}>
                <Ionicons name="chatbubble-ellipses-outline" size={11} color={colors.primary} />
                <Text style={styles.bidCountBadgeText}>{`${bidCount} ${t('bids')}`}</Text>
              </View>
            )}
            {!compact && typeof request.distance === 'number' && request.distance > 0 && (
              <View style={[styles.distanceBadge, compact && styles.distanceBadgeCompact]}>
                <Ionicons name="navigate-outline" size={11} color={colors.primary} />
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
                accessibilityHint={
                  request.is_favorite ? t('removeFavoriteHint') : t('addFavoriteHint')
                }
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
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },
  cardCompact: {
    borderRadius: borderRadius.lg,
    marginBottom: 0,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: REQUEST_CARD_IMAGE_HEIGHT,
    backgroundColor: colors.border.light,
  },
  imageCompact: {
    height: REQUEST_CARD_IMAGE_HEIGHT + 12,
  },
  imagePlaceholder: {
    width: '100%',
    height: REQUEST_CARD_IMAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderCompact: {
    height: REQUEST_CARD_IMAGE_HEIGHT + 12,
  },
  priceOverlayFloating: {
    position: 'absolute',
    left: spacing.xs,
    top: spacing.xs,
  },
  priceOverlayFloatingCompact: {
    left: spacing.xxxs,
    top: spacing.xxxs,
  },
  priceOverlayBadgeFloating: {
    backgroundColor: colors.overlay,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.xs,
    maxWidth: '88%',
    alignSelf: 'flex-start',
  },
  priceOverlayBadgeFloatingCompact: {
    paddingHorizontal: spacing.md,
    paddingTop: 0,
    paddingBottom: spacing.xs,
    maxWidth: '82%',
  },
  priceOverlayTextFloating: {
    fontSize: fontSize.xxl,
    lineHeight: 26,
    textAlign: 'center',
    fontWeight: fontWeight.bold,
    color: colors.white,
    includeFontPadding: false,
  },
  priceOverlayTextFloatingCompact: {
    fontSize: fontSize.lg,
    lineHeight: 20,
    fontWeight: fontWeight.bold,
  },
  contentWrap: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  contentWrapCompact: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: 0,
    gap: spacing.xxxs,
    minHeight: 120,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textTransform: 'capitalize' as const,
  },
  titleCompact: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
  },
  routeBlock: {
    gap: spacing.xs,
  },
  routeBlockCompact: {
    gap: spacing.xxxs,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  routeLineCompact: {
    minHeight: 22,
  },
  routeText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  routeTextCompact: {
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
    gap: spacing.xs,
  },
  footerRowCompact: {
    marginTop: spacing.xxxs,
    gap: spacing.xxxs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    flexShrink: 1,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    flexShrink: 1,
  },
  metaTextCompact: {
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxxs,
  },
  distanceBadgeCompact: {
    paddingHorizontal: spacing.xxxs,
  },
  distanceBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  bidCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxxs,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxxs,
  },
  bidCountBadgeCompact: {
    paddingHorizontal: spacing.xxxs,
  },
  bidCountBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
});
