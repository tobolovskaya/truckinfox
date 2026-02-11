import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing, borderRadius } from '../../theme';
import { IOSButton } from '../../components/IOSButton';
import { platformShadow } from '../../lib/platformShadow';
import { formatCurrency, formatDate } from '../../utils/formatting';

export default function RequestDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // Mock data - in production, this would come from Firestore
  const request = {
    id,
    pickup: 'Oslo, Norway',
    delivery: 'Bergen, Norway',
    cargoType: 'Furniture',
    weight: 500,
    pickupDate: new Date('2024-03-15'),
    deliveryDate: new Date('2024-03-16'),
    description:
      'Moving furniture from apartment to new house. Includes sofa, dining table, and chairs.',
    status: 'open',
    customerId: 'user123',
    customerName: 'John Doe',
    bidCount: 3,
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{request.cargoType}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{request.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Route</Text>
        <View style={styles.locationRow}>
          <Text style={styles.locationIcon}>📍</Text>
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Pickup</Text>
            <Text style={styles.locationText}>{request.pickup}</Text>
            <Text style={styles.dateText}>{formatDate(request.pickupDate)}</Text>
          </View>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.locationRow}>
          <Text style={styles.locationIcon}>🎯</Text>
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Delivery</Text>
            <Text style={styles.locationText}>{request.delivery}</Text>
            <Text style={styles.dateText}>{formatDate(request.deliveryDate)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Cargo Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Weight:</Text>
          <Text style={styles.detailValue}>{request.weight} kg</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type:</Text>
          <Text style={styles.detailValue}>{request.cargoType}</Text>
        </View>
        <Text style={styles.description}>{request.description}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <Text style={styles.customerName}>{request.customerName}</Text>
      </View>

      {request.bidCount > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bids</Text>
          <Text style={styles.bidCountText}>{request.bidCount} carriers have placed bids</Text>
        </View>
      )}

      <View style={styles.actions}>
        <IOSButton
          title="Place Bid"
          onPress={() => router.push(`/request-details/${id}/place-bid`)}
          style={styles.button}
        />
        <IOSButton
          title="Message Customer"
          onPress={() => router.push(`/chat/${request.customerId}`)}
          variant="outlined"
          style={styles.button}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
    ...platformShadow(2),
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.background,
    marginTop: spacing.md,
    padding: spacing.lg,
    ...platformShadow(1),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  locationText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  routeLine: {
    height: 30,
    width: 2,
    backgroundColor: colors.primary,
    marginLeft: 11,
    marginVertical: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  customerName: {
    fontSize: 16,
    color: colors.text,
  },
  bidCountText: {
    fontSize: 16,
    color: colors.text,
  },
  actions: {
    padding: spacing.lg,
  },
  button: {
    marginBottom: spacing.md,
  },
});
