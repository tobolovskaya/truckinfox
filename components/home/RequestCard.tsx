import React from 'react';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../lib/sharedStyles';
import { getCargoTypeColors, getCargoTypeIcon } from '../../constants/cardStyles';
import { formatCurrency, formatDate, formatWeight } from '../../utils/formatting';
import { useTranslation } from 'react-i18next';

interface CargoRequest {
  id: string;
  title?: string;
  description?: string;
  cargo_type?: string;
  weight?: number;
  from_address?: string;
  to_address?: string;
  pickup_date?: string;
  price?: number;
  status?: string;
  created_at?: string;
  distance?: number;
  images?: string[];
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
    typeof request.price === 'number' ? formatCurrency(request.price) : t('priceOnAgreement');
  const weightText =
    typeof request.weight === 'number' ? formatWeight(request.weight) : t('weightUnknown');
  const dateText = request.pickup_date ? formatDate(request.pickup_date) : t('dateNotSet');
  const cargoType = request.cargo_type || 'other';
  const cargoColors = getCargoTypeColors(cargoType);
  const cargoIcon = getCargoTypeIcon(cargoType);

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact, cardStyle]}
      onPress={() => onPress(request)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={t('openRequestDetails')}
    >
      {request.images?.[0] ? (
        <Image source={{ uri: request.images[0] }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.imagePlaceholder, { backgroundColor: cargoColors.background }]}>
          <Ionicons name={cargoIcon} size={40} color={cargoColors.text} />
        </View>
      )}
      <View style={styles.headerRow}>
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.price, compact && styles.priceCompact]}>{priceText}</Text>
      </View>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t(request.cargo_type || 'other')}</Text>
        </View>
        <Text style={styles.metaText}>{weightText}</Text>
      </View>

      <View style={styles.routeBlock}>
        <View style={styles.routeSection}>
          <View style={styles.routeLine}>
            <Ionicons name="radio-button-on" size={12} color={colors.primary} />
            <Text style={[styles.routeText, compact && styles.routeTextCompact]}>
              {fromAddress}
            </Text>
          </View>
        </View>
        <View style={styles.routeSection}>
          <View style={styles.routeLine}>
            <Ionicons name="location-outline" size={12} color={colors.text.secondary} />
            <Text style={[styles.routeText, compact && styles.routeTextCompact]}>{toAddress}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.metaText}>{dateText}</Text>
        {showFavorite && onToggleFavorite && (
          <TouchableOpacity
            onPress={() => onToggleFavorite(request.id)}
            accessibilityRole="button"
            accessibilityLabel={request.is_favorite ? t('unfavorite') : t('favorite')}
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
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  cardCompact: {
    padding: spacing.md,
  },
  image: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    backgroundColor: colors.border.light,
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
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
    fontSize: fontSize.xs,
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
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
});
