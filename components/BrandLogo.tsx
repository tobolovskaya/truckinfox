import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../lib/sharedStyles';

type BrandLogoProps = {
  size?: 'sm' | 'md';
  variant?: 'full' | 'mark';
};

export function BrandLogo({ size = 'md', variant = 'full' }: BrandLogoProps) {
  const isSmall = size === 'sm';
  const markOnly = variant === 'mark';

  return (
    <View style={[styles.container, isSmall && styles.containerSmall]}>
      <View style={[styles.mark, isSmall && styles.markSmall]}>
        <Text style={[styles.markText, isSmall && styles.markTextSmall]}>TF</Text>
      </View>
      {!markOnly && <Text style={[styles.wordmark, isSmall && styles.wordmarkSmall]}>TruckinFox</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  containerSmall: {
    gap: spacing.xs,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markSmall: {
    width: 28,
    height: 28,
  },
  markText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  markTextSmall: {
    fontSize: fontSize.xs,
  },
  wordmark: {
    color: colors.text.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
  },
  wordmarkSmall: {
    fontSize: fontSize.lg,
  },
});
