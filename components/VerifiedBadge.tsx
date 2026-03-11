import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing } from '../lib/sharedStyles';

interface VerifiedBadgeProps {
  /** 'inline' — small chip next to a name; 'banner' — full-width row on profile page */
  variant?: 'inline' | 'banner';
}

export function VerifiedBadge({ variant = 'inline' }: VerifiedBadgeProps) {
  if (variant === 'banner') {
    return (
      <View style={styles.banner}>
        <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
        <Text style={styles.bannerText}>Verifisert transportør (Brønnøysund)</Text>
      </View>
    );
  }

  return (
    <View style={styles.chip}>
      <Ionicons name="shield-checkmark" size={11} color="#fff" />
      <Text style={styles.chipText}>Verifisert</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#fff',
    letterSpacing: 0.2,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  bannerText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary,
  },
});
