import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triggerHapticFeedback } from '../utils/haptics';
import { theme } from '../theme/theme';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../lib/sharedStyles';
import { useResponsive } from '../utils/responsive';

interface IOSButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'link';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  hapticFeedback?: 'light' | 'medium' | 'heavy';
}

export function IOSButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  fullWidth = false,
  hapticFeedback = 'light',
}: IOSButtonProps) {
  const { getResponsiveValue } = useResponsive();

  const handlePress = () => {
    if (disabled || loading) return;

    // Add haptic feedback on iOS
    if (hapticFeedback) {
      triggerHapticFeedback[hapticFeedback]?.();
    }

    onPress();
  };

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: borderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: iconPosition === 'right' ? 'row-reverse' : 'row',
    };

    // Size variants
    const sizeStyles: Record<string, ViewStyle> = {
      small: {
        paddingVertical: getResponsiveValue({
          small: spacing.xs,
          medium: spacing.sm,
          large: spacing.md,
        }),
        paddingHorizontal: getResponsiveValue({
          small: spacing.md,
          medium: spacing.lg,
          large: spacing.xl,
        }),
        minHeight: getResponsiveValue({ small: 44, medium: 46, large: 48 }),
      },
      medium: {
        paddingVertical: getResponsiveValue({
          small: spacing.sm,
          medium: spacing.md,
          large: spacing.lg,
        }),
        paddingHorizontal: getResponsiveValue({
          small: spacing.lg,
          medium: spacing.xl,
          large: spacing.xxl,
        }),
        minHeight: getResponsiveValue({ small: 48, medium: 52, large: 56 }),
      },
      large: {
        paddingVertical: getResponsiveValue({ small: spacing.md, medium: 18, large: 20 }),
        paddingHorizontal: getResponsiveValue({
          small: spacing.xl,
          medium: spacing.xxl,
          large: spacing.xxxl,
        }),
        minHeight: getResponsiveValue({ small: 52, medium: 58, large: 64 }),
      },
    };

    // Color variants
    const variantStyles: Record<string, ViewStyle> = {
      primary: {
        backgroundColor: disabled ? theme.iconColors.ios.lightGray : theme.iconColors.primary,
        ...sizeStyles[size],
      },
      secondary: {
        backgroundColor: disabled ? '#F9FAFB' : '#FFFFFF',
        borderWidth: 1,
        borderColor: disabled ? colors.border.light : colors.border.default,
        ...sizeStyles[size],
      },
      destructive: {
        backgroundColor: disabled ? theme.iconColors.ios.lightGray : theme.iconColors.ios.red,
        ...sizeStyles[size],
      },
      ghost: {
        backgroundColor: 'transparent',
        ...sizeStyles[size],
      },
      link: {
        backgroundColor: 'transparent',
        paddingVertical: spacing.xxxs,
        paddingHorizontal: 0,
        minHeight: 'auto' as any,
      },
    };

    return {
      ...baseStyle,
      ...variantStyles[variant],
      ...(fullWidth && { alignSelf: 'stretch' }),
      ...(disabled && { opacity: 0.6 }),
    };
  };

  const getTextStyle = (): TextStyle => {
    const sizeTextStyles: Record<string, TextStyle> = {
      small: {
        fontSize: getResponsiveValue({
          small: fontSize.xs,
          medium: fontSize.sm,
          large: fontSize.md,
        }),
        fontWeight: '500',
        letterSpacing: 0.2,
      },
      medium: {
        fontSize: getResponsiveValue({
          small: fontSize.sm,
          medium: fontSize.md,
          large: fontSize.lg,
        }),
        fontWeight: '500',
        letterSpacing: 0.3,
      },
      large: {
        fontSize: getResponsiveValue({
          small: fontSize.md,
          medium: fontSize.lg,
          large: fontSize.xl,
        }),
        fontWeight: '500',
        letterSpacing: 0.4,
      },
    };

    const variantTextStyles: Record<string, TextStyle> = {
      primary: {
        color: theme.iconColors.white,
      },
      secondary: {
        color: disabled ? theme.iconColors.ios.gray : theme.iconColors.primary, // Updated to match ui.txt spec
      },
      destructive: {
        color: theme.iconColors.white,
      },
      ghost: {
        color: disabled ? theme.iconColors.ios.gray : theme.iconColors.primary,
      },
      link: {
        color: disabled ? theme.iconColors.ios.gray : theme.iconColors.ios.blue,
        fontSize: fontSize.lg,
        fontWeight: '400',
      },
    };

    return {
      ...sizeTextStyles[size],
      ...variantTextStyles[variant],
    };
  };

  const getIconSize = (): number => {
    const sizeMap = {
      small: getResponsiveValue({ small: 14, medium: 16, large: 18 }),
      medium: getResponsiveValue({ small: 16, medium: 18, large: 20 }),
      large: getResponsiveValue({ small: 18, medium: 20, large: 22 }),
    };
    return sizeMap[size];
  };

  const renderIcon = () => {
    if (!icon || loading) return null;

    return (
      <Ionicons
        name={icon as any}
        size={getIconSize()}
        color={getTextStyle().color as string}
        style={{
          marginRight: iconPosition === 'left' ? 8 : 0,
          marginLeft: iconPosition === 'right' ? 8 : 0,
        }}
      />
    );
  };

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator size="small" color={getTextStyle().color} />;
    }

    return (
      <>
        {renderIcon()}
        <Text style={[getTextStyle(), textStyle]}>{title}</Text>
      </>
    );
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {renderContent()}
    </TouchableOpacity>
  );
}

// Pre-configured button variants for common use cases
export const PrimaryButton = (props: Omit<IOSButtonProps, 'variant'>) => (
  <IOSButton {...props} variant="primary" />
);

export const SecondaryButton = (props: Omit<IOSButtonProps, 'variant'>) => (
  <IOSButton {...props} variant="secondary" />
);

export const DestructiveButton = (props: Omit<IOSButtonProps, 'variant'>) => (
  <IOSButton {...props} variant="destructive" hapticFeedback="medium" />
);

export const GhostButton = (props: Omit<IOSButtonProps, 'variant'>) => (
  <IOSButton {...props} variant="ghost" />
);

export const LinkButton = (props: Omit<IOSButtonProps, 'variant'>) => (
  <IOSButton {...props} variant="link" />
);

const styles = StyleSheet.create({});
