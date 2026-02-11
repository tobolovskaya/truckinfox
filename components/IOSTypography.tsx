import React from 'react';
import { Text as RNText, TextProps, StyleSheet, TextStyle } from 'react-native';
import { colors, typography } from '../theme/theme';

interface IOSTypographyProps extends TextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'button';
  color?: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
}

export const IOSTypography: React.FC<IOSTypographyProps> = ({
  variant = 'body',
  color = colors.text,
  weight = 'regular',
  style,
  children,
  ...props
}) => {
  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      color,
      fontWeight: typography.fontWeight[weight],
    };

    switch (variant) {
      case 'h1':
        return {
          ...baseStyle,
          fontSize: typography.fontSize.xxxl,
          lineHeight: typography.fontSize.xxxl * typography.lineHeight.tight,
        };
      case 'h2':
        return {
          ...baseStyle,
          fontSize: typography.fontSize.xxl,
          lineHeight: typography.fontSize.xxl * typography.lineHeight.tight,
        };
      case 'h3':
        return {
          ...baseStyle,
          fontSize: typography.fontSize.xl,
          lineHeight: typography.fontSize.xl * typography.lineHeight.normal,
        };
      case 'body':
        return {
          ...baseStyle,
          fontSize: typography.fontSize.base,
          lineHeight: typography.fontSize.base * typography.lineHeight.normal,
        };
      case 'caption':
        return {
          ...baseStyle,
          fontSize: typography.fontSize.sm,
          lineHeight: typography.fontSize.sm * typography.lineHeight.normal,
        };
      case 'button':
        return {
          ...baseStyle,
          fontSize: typography.fontSize.base,
          fontWeight: typography.fontWeight.semibold,
        };
      default:
        return baseStyle;
    }
  };

  return (
    <RNText style={[getTextStyle(), style]} {...props}>
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({});

export default IOSTypography;
