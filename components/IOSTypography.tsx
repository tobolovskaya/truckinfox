import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { theme } from '../theme/theme';
import { fontSize } from '../lib/sharedStyles';

interface IOSTextProps extends TextProps {
  variant?:
    | 'largeTitle'
    | 'title1'
    | 'title2'
    | 'title3'
    | 'headline'
    | 'body'
    | 'callout'
    | 'subhead'
    | 'footnote'
    | 'caption1'
    | 'caption2';
  color?: 'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'system' | 'accent' | 'destructive';
  weight?: 'light' | 'regular' | 'medium' | 'semibold' | 'bold';
  numberOfLines?: number;
}

export function IOSText({
  variant = 'body',
  color = 'primary',
  weight,
  style,
  children,
  ...props
}: IOSTextProps) {
  const getTypographyStyle = () => {
    const typography = theme.typography?.[variant] ||
      theme.typography?.body || {
        fontSize: fontSize.lg,
        lineHeight: 22,
        fontWeight: '400',
      };

    const baseStyle = {
      fontSize: typography.fontSize,
      lineHeight: typography.lineHeight,
      fontWeight: (weight || typography.fontWeight) as TextStyle['fontWeight'],
    };

    const colorStyles = {
      primary: { color: theme.colors.label || theme.colors.onBackground || '#000000' },
      secondary: {
        color: theme.colors.secondaryLabel || theme.colors.onSurfaceVariant || '#8E8E93',
      },
      tertiary: { color: theme.colors.tertiaryLabel || theme.colors.onSurfaceVariant || '#8E8E93' },
      quaternary: {
        color: theme.colors.quaternaryLabel || theme.colors.onSurfaceVariant || '#8E8E93',
      },
      system: { color: theme.colors.onBackground || '#000000' },
      accent: { color: theme.colors.primary || '#FF7043' },
      destructive: { color: theme.colors.error || '#FF3B30' },
    };

    return [baseStyle, colorStyles[color]];
  };

  return (
    <Text style={[getTypographyStyle(), style]} {...props}>
      {children}
    </Text>
  );
}

// Pre-configured text components
export const LargeTitle = (props: Omit<IOSTextProps, 'variant'>) => (
  <IOSText {...props} variant="largeTitle" />
);

export const Title1 = (props: Omit<IOSTextProps, 'variant'>) => (
  <IOSText {...props} variant="title1" />
);

export const Title2 = (props: Omit<IOSTextProps, 'variant'>) => (
  <IOSText {...props} variant="title2" />
);

export const Title3 = (props: Omit<IOSTextProps, 'variant'>) => (
  <IOSText {...props} variant="title3" />
);

export const Headline = (props: Omit<IOSTextProps, 'variant'>) => (
  <IOSText {...props} variant="headline" />
);

export const Body = (props: Omit<IOSTextProps, 'variant'>) => <IOSText {...props} variant="body" />;

export const Callout = (props: Omit<IOSTextProps, 'variant'>) => (
  <IOSText {...props} variant="callout" />
);

export const Subhead = (props: Omit<IOSTextProps, 'variant'>) => (
  <IOSText {...props} variant="subhead" />
);

export const Footnote = (props: Omit<IOSTextProps, 'variant'>) => (
  <IOSText {...props} variant="footnote" />
);

export const Caption1 = (props: Omit<IOSTextProps, 'variant'>) => (
  <IOSText {...props} variant="caption1" />
);

export const Caption2 = (props: Omit<IOSTextProps, 'variant'>) => (
  <IOSText {...props} variant="caption2" />
);
