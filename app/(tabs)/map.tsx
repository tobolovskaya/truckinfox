import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';
import { ScreenHeader } from '../../components/ScreenHeader';

export default function MapScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Map" onBackPress={() => router.back()} />

      <View style={styles.emptyState}>
        <Ionicons name="map-outline" size={64} color={colors.text.tertiary} />
        <Text style={styles.emptyTitle}>Map view is not available yet</Text>
        <Text style={styles.emptyText}>
          Use marketplace search for now or create a new request.
        </Text>

        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(tabs)/home')}
            accessibilityRole="button"
            accessibilityLabel="Go to marketplace"
          >
            <Text style={styles.primaryButtonText}>Go to marketplace</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(tabs)/create')}
            accessibilityRole="button"
            accessibilityLabel="Create request"
          >
            <Text style={styles.secondaryButtonText}>Create request</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  ctaRow: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  secondaryButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
