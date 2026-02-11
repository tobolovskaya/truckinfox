import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing, borderRadius } from '../theme';

interface IOSButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outlined' | 'text';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const IOSButton: React.FC<IOSButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      ...styles.button,
    };

    if (disabled) {
      return { ...baseStyle, ...styles.disabled };
    }

    switch (variant) {
      case 'primary':
        return { ...baseStyle, ...styles.primary };
      case 'secondary':
        return { ...baseStyle, ...styles.secondary };
      case 'outlined':
        return { ...baseStyle, ...styles.outlined };
      case 'text':
        return { ...baseStyle, ...styles.text };
      default:
        return baseStyle;
    }
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      ...styles.buttonText,
    };

    if (disabled) {
      return { ...baseStyle, color: colors.textDisabled };
    }

    switch (variant) {
      case 'primary':
        return { ...baseStyle, color: colors.background };
      case 'secondary':
        return { ...baseStyle, color: colors.background };
      case 'outlined':
        return { ...baseStyle, color: colors.primary };
      case 'text':
        return { ...baseStyle, color: colors.primary };
      default:
        return baseStyle;
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[getTextStyle(), textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  text: {
    backgroundColor: 'transparent',
  },
  disabled: {
    backgroundColor: colors.divider,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});

export default IOSButton;
