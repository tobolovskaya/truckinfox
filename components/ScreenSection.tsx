import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../lib/sharedStyles';

interface ScreenSectionProps {
  /** Section title (optional) */
  title?: string;
  /** Section subtitle/description (optional) */
  subtitle?: string;
  /** Children content */
  children: React.ReactNode;
  /** Custom container style */
  style?: ViewStyle;
  /** Remove default padding */
  noPadding?: boolean;
  /** Remove default margin */
  noMargin?: boolean;
  /** Add shadow */
  elevated?: boolean;
  /** Background color (default: white) */
  backgroundColor?: string;
  /** Right action element (e.g., "See All" button) */
  rightAction?: React.ReactNode;
}

/**
 * Standardized screen section component
 * Ensures consistent content sections across all screens
 *
 * Features:
 * - Consistent spacing and borders
 * - Optional title and subtitle
 * - Elevation/shadow support
 * - Configurable padding and margins
 *
 * @example
 * <ScreenSection title="Profile Information" subtitle="Update your details">
 *   <InputField />
 * </ScreenSection>
 */
export function ScreenSection({
  title,
  subtitle,
  children,
  style,
  noPadding = false,
  noMargin = false,
  elevated = true,
  backgroundColor = colors.white,
  rightAction,
}: ScreenSectionProps) {
  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        !noMargin && styles.containerWithMargin,
        elevated && shadows.sm,
        style,
      ]}
    >
      {(title || subtitle || rightAction) && (
        <View style={[styles.header, !noPadding && styles.headerWithPadding]}>
          <View style={styles.headerText}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
        </View>
      )}

      <View style={[!noPadding && styles.content]}>{children}</View>
    </View>
  );
}

/**
 * Pre-configured section variant with list-style layout
 * No padding, for use with FlatList or ScrollView content
 */
export function ScreenSectionList({
  title,
  subtitle,
  children,
  style,
  rightAction,
}: Omit<ScreenSectionProps, 'noPadding'>) {
  return (
    <ScreenSection
      title={title}
      subtitle={subtitle}
      noPadding
      style={style}
      rightAction={rightAction}
    >
      {children}
    </ScreenSection>
  );
}

/**
 * Pre-configured section variant with full-bleed content
 * No padding, no margin, useful for full-width images or maps
 */
export function ScreenSectionFullBleed({
  children,
  style,
  elevated = false,
}: Pick<ScreenSectionProps, 'children' | 'style' | 'elevated'>) {
  return (
    <ScreenSection noPadding noMargin elevated={elevated} style={style}>
      {children}
    </ScreenSection>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  containerWithMargin: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerWithPadding: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  rightAction: {
    marginLeft: spacing.md,
  },
  content: {
    padding: spacing.xl,
  },
});
