import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../lib/sharedStyles';
import { TOUCH_TARGET } from '../constants/touchTargets';
import * as Haptics from 'expo-haptics';
import { useResponsive } from '../utils/responsive';

interface ScreenHeaderProps {
  /** Header title text */
  title: string;
  /** Show back button (default: true) */
  showBackButton?: boolean;
  /** Custom back button handler (default: router.back()) */
  onBackPress?: () => void;
  /** Right side action button */
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    label?: string;
    badge?: number;
  };
  /** Secondary right action button */
  secondaryRightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    label?: string;
  };
  /** Custom background color */
  backgroundColor?: string;
  /** Show border at bottom */
  showBorder?: boolean;
  /** Custom content to replace title */
  customCenter?: React.ReactNode;
}

/**
 * Standardized screen header component
 * Ensures consistent header design across all screens
 *
 * Features:
 * - 44pt touch targets (Apple HIG compliant)
 * - Consistent spacing and typography
 * - Safe area handling
 * - Haptic feedback on interactions
 * - Optional back button, right actions, badges
 *
 * @example
 * <ScreenHeader
 *   title="Settings"
 *   showBackButton
 *   rightAction={{ icon: 'settings-outline', onPress: handleSettings }}
 * />
 */
export function ScreenHeader({
  title,
  showBackButton = true,
  onBackPress,
  rightAction,
  secondaryRightAction,
  backgroundColor = colors.white,
  showBorder = true,
  customCenter,
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getResponsiveValue } = useResponsive();

  const horizontalPadding = getResponsiveValue({
    small: spacing.md,
    medium: spacing.lg,
    large: spacing.xl,
  });
  const verticalPadding = getResponsiveValue({
    small: spacing.sm,
    medium: spacing.md,
    large: spacing.lg,
  });
  const titleSize = getResponsiveValue({
    small: fontSize.lg,
    medium: fontSize.xl,
    large: fontSize.xxl,
  });
  const touchSize = getResponsiveValue({
    small: TOUCH_TARGET.MIN,
    medium: TOUCH_TARGET.MIN,
    large: TOUCH_TARGET.MIN + 4,
  });

  const handleBackPress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const handleRightAction = (action: () => void) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    action();
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor, paddingTop: insets.top },
        showBorder && styles.containerWithBorder,
      ]}
    >
      <View
        style={[
          styles.content,
          {
            paddingHorizontal: horizontalPadding,
            paddingVertical: verticalPadding,
            minHeight: touchSize + verticalPadding * 2,
          },
        ]}
      >
        {/* Left: Back Button */}
        <View style={[styles.leftSection, { width: touchSize }]}>
          {showBackButton && (
            <TouchableOpacity
              style={[styles.backButton, { width: touchSize, height: touchSize }]}
              onPress={handleBackPress}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint="Navigate to previous screen"
            >
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Center: Title or Custom Content */}
        <View style={styles.centerSection}>
          {customCenter || (
            <Text style={[styles.title, { fontSize: titleSize }]} numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>

        {/* Right: Action Buttons */}
        <View style={[styles.rightSection, { minWidth: touchSize }]}>
          {secondaryRightAction && (
            <TouchableOpacity
              style={[styles.actionButton, { width: touchSize, height: touchSize }]}
              onPress={() => handleRightAction(secondaryRightAction.onPress)}
              accessibilityRole="button"
              accessibilityLabel={secondaryRightAction.label}
            >
              <Ionicons name={secondaryRightAction.icon} size={24} color={colors.text.primary} />
            </TouchableOpacity>
          )}

          {rightAction && (
            <TouchableOpacity
              style={[styles.actionButton, { width: touchSize, height: touchSize }]}
              onPress={() => handleRightAction(rightAction.onPress)}
              accessibilityRole="button"
              accessibilityLabel={rightAction.label}
            >
              <Ionicons name={rightAction.icon} size={24} color={colors.text.primary} />
              {rightAction.badge !== undefined && rightAction.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {rightAction.badge > 99 ? '99+' : rightAction.badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Placeholder for alignment when no right actions */}
          {!rightAction && !secondaryRightAction && (
            <View style={[styles.placeholder, { width: touchSize }]} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
  },
  containerWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    ...Platform.select({
      ios: shadows.sm,
      android: { elevation: 2 },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: TOUCH_TARGET.MIN + spacing.md * 2,
  },
  leftSection: {
    width: TOUCH_TARGET.MIN,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.sm,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: TOUCH_TARGET.MIN,
    justifyContent: 'flex-end',
  },
  backButton: {
    width: TOUCH_TARGET.MIN,
    height: TOUCH_TARGET.MIN,
    borderRadius: TOUCH_TARGET.MIN / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    width: TOUCH_TARGET.MIN,
    height: TOUCH_TARGET.MIN,
    borderRadius: TOUCH_TARGET.MIN / 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.error,
    borderRadius: borderRadius.sm,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxs,
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.white,
    includeFontPadding: false,
  },
  placeholder: {
    width: TOUCH_TARGET.MIN,
  },
});
