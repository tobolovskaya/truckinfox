import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { platformShadow } from '../../lib/platformShadow';
import { formatCurrency, formatDate } from '../../utils/formatting';

interface CargoRequestCardProps {
  id: string;
  pickup: string;
  delivery: string;
  cargoType: string;
  weight: number;
  pickupDate: Date | string;
  status: string;
  bidCount?: number;
  onPress: () => void;
}

export const CargoRequestCard: React.FC<CargoRequestCardProps> = ({
  pickup,
  delivery,
  cargoType,
  weight,
  pickupDate,
  status,
  bidCount = 0,
  onPress,
}) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return colors.success;
      case 'assigned':
        return colors.info;
      case 'in_transit':
        return colors.warning;
      case 'completed':
        return colors.textSecondary;
      default:
        return colors.textSecondary;
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <Text style={styles.cargoType}>{cargoType}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <View style={styles.locationContainer}>
        <Text style={styles.locationLabel}>From:</Text>
        <Text style={styles.location} numberOfLines={1}>
          {pickup}
        </Text>
      </View>

      <View style={styles.locationContainer}>
        <Text style={styles.locationLabel}>To:</Text>
        <Text style={styles.location} numberOfLines={1}>
          {delivery}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.detail}>
          {weight} kg • {formatDate(pickupDate)}
        </Text>
        {bidCount > 0 && <Text style={styles.bidCount}>{bidCount} bids</Text>}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    ...platformShadow(2),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cargoType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  locationContainer: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  locationLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    width: 50,
  },
  location: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  detail: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bidCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default CargoRequestCard;
