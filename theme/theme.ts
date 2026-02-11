import { MD3LightTheme } from 'react-native-paper';

// TruckinFox iOS 26-style Design System

// iOS 26-inspired design system
export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    // Primary - Orange accent (TruckinFox brand color)
    primary: '#FF7043',
    primaryContainer: '#FFD9CC',

    // Secondary - Warmer orange accent
    secondary: '#FF8A65',
    secondaryContainer: '#FFE0D9',

    // Tertiary - Success green
    tertiary: '#4CAF50',
    tertiaryContainer: '#F0FDF4',

    // Surface colors
    surface: '#FFFFFF',
    surfaceVariant: '#FAFAFA', // Light gray background
    background: '#FAFAFA', // Light gray background

    // Error colors
    error: '#F44336',
    errorContainer: '#FEE2E2',

    // Text colors
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#FF7043',
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#FF8A65',
    onTertiary: '#FFFFFF',
    onTertiaryContainer: '#4CAF50',
    onSurface: '#212121', // Text primary
    onSurfaceVariant: '#616161', // Text secondary
    onBackground: '#212121',
    onError: '#FFFFFF',
    onErrorContainer: '#F44336',

    // Borders and outlines
    outline: '#E0E0E0', // Borders / Dividers
    outlineVariant: '#E0E0E0',

    // System UI colors
    inverseSurface: '#212121',
    inverseOnSurface: '#FAFAFA',
    inversePrimary: '#FF7043',

    // System colors
    shadow: '#000000',
    scrim: '#000000',
    backdrop: 'rgba(0, 0, 0, 0.4)',

    // Warning color
    warning: '#FFC107',

    // iOS label colors
    label: '#212121',
    secondaryLabel: '#616161',
    tertiaryLabel: '#61616199',
    quaternaryLabel: '#61616160',

    // iOS fill colors
    systemFill: '#78788033',
    secondarySystemFill: '#78788028',
    tertiarySystemFill: '#7676801E',
    quaternarySystemFill: '#74748014',

    // iOS grouped background colors
    systemGroupedBackground: '#FAFAFA',
    secondarySystemGroupedBackground: '#FFFFFF',
    tertiarySystemGroupedBackground: '#FAFAFA',
  },

  // iOS-style spacing system
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // iOS-style border radius
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    pill: 999,
  },

  // iOS-style typography scale
  typography: {
    largeTitle: {
      fontSize: 34,
      fontWeight: '700',
      lineHeight: 41,
    },
    title1: {
      fontSize: 28,
      fontWeight: '700',
      lineHeight: 34,
    },
    title2: {
      fontSize: 22,
      fontWeight: '600', // H1 spec
      lineHeight: 28,
    },
    title3: {
      fontSize: 20,
      fontWeight: '500', // H2 spec
      lineHeight: 25,
    },
    headline: {
      fontSize: 16,
      fontWeight: '500', // H3 spec
      lineHeight: 22,
    },
    body: {
      fontSize: 14,
      fontWeight: '400', // Body spec
      lineHeight: 20,
    },
    callout: {
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 21,
    },
    subhead: {
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 20,
    },
    footnote: {
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
    },
    caption1: {
      fontSize: 12,
      fontWeight: '400', // Caption spec
      lineHeight: 16,
    },
    caption2: {
      fontSize: 11,
      fontWeight: '400',
      lineHeight: 13,
    },
  },

  // Icon colors palette
  iconColors: {
    // Primary brand color for active elements
    primary: '#FF7043',

    // Gray scale (unified with text colors)
    gray: {
      primary: '#616161',      // Text secondary
      secondary: '#9CA3AF',    // Secondary gray for less prominent elements
      light: '#FF7043',        // Updated to primary orange
      lighter: '#E0E0E0',      // Border/divider color for disabled states
    },

    // Semantic colors
    success: '#4CAF50',        // Green for success
    error: '#F44336',          // Red for errors
    warning: '#FFC107',        // Yellow for warnings
    info: '#FF8A65',           // Secondary orange for information

    // Special colors
    rating: '#FFC107',         // Warning/yellow for stars
    white: '#FFFFFF',          // White for icons on colored backgrounds
    dark: '#212121',           // Text primary for text-like icons

    // iOS system colors (for compatibility with IOSButton and IOSActionSheet)
    ios: {
      blue: '#007AFF',
      red: '#F44336',
      green: '#4CAF50',
      orange: '#FF7043',
      gray: '#616161',
      lightGray: '#E0E0E0',
    },
  },
};
