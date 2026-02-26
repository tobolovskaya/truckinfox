import { StyleSheet, Platform, Appearance } from 'react-native';
import { theme } from '../theme/theme';
import { darkTheme } from '../theme/darkTheme';
import { useThemeMode } from '../contexts/ThemeContext';

const buildColors = (scheme: 'light' | 'dark' | null | undefined) => {
  const resolvedTheme = scheme === 'dark' ? darkTheme : theme;
  const resolvedColors = resolvedTheme.colors;

  const textColors = {
    primary: (resolvedColors as any).text?.primary ?? resolvedColors.onSurface ?? '#212121',
    secondary: (resolvedColors as any).text?.secondary ?? resolvedColors.onSurfaceVariant ?? '#616161',
    tertiary: (resolvedColors as any).text?.tertiary ?? '#9CA3AF',
  };

  const borderColors = {
    light: (resolvedColors as any).border?.light ?? resolvedColors.outlineVariant ?? '#F3F4F6',
    default: (resolvedColors as any).border?.default ?? resolvedColors.outline ?? '#E5E7EB',
  };

  return {
    primary: resolvedColors.primary,
    primaryLight: resolvedColors.primaryContainer,
    secondary: resolvedColors.secondary,

    background: resolvedColors.background,
    backgroundPrimary: resolvedColors.background,
    backgroundLight: resolvedColors.surfaceVariant,
    backgroundVeryLight: resolvedColors.surface,
    surface: resolvedColors.surface,
    surfaceVariant: resolvedColors.surfaceVariant,

    text: {
      primary: textColors.primary,
      secondary: textColors.secondary,
      tertiary: textColors.tertiary,
      dark: '#374151',
      disabled: '#D1D5DB',
    },

    border: {
      light: borderColors.light,
      default: borderColors.default,
      dark: '#9CA3AF',
      medium: '#D1D5DB',
    },

    status: {
      success: resolvedColors.tertiary,
      successBackground: resolvedColors.tertiaryContainer,
      error: resolvedColors.error,
      errorBackground: '#FEF2F2',
      warning: '#FFC107',
      info: '#FF8A65',
    },

    error: resolvedColors.error,
    success: resolvedColors.tertiary,
    info: '#FF8A65',

    badge: {
      background: '#F3F4F6',
      text: '#4B5563',
    },

    overlay: 'rgba(0, 0, 0, 0.5)',
    white: '#FFFFFF',
    black: '#000000',
  };
};

export const getAppColors = (scheme?: 'light' | 'dark' | null) =>
  buildColors(scheme ?? Appearance.getColorScheme());

export const colors = getAppColors();

export const useAppThemeStyles = () => {
  const { resolvedScheme } = useThemeMode();

  return {
    colors: getAppColors(resolvedScheme),
    spacing,
    borderRadius,
    fontSize,
    fontWeight,
  };
};

export const spacing = {
  xxs: 2, // Micro spacing for tight elements
  xxxs: 4, // Extra small spacing
  xs: 8, // Small spacing (updated for consistency)
  sm: 12, // Small-medium spacing
  md: 16, // Medium spacing
  lg: 20, // Large spacing
  xl: 24, // Extra large spacing
  xxl: 32, // Extra extra large spacing
  xxxl: 40, // Huge spacing
  huge: 48, // Maximum spacing
};

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  huge: 34,
};

export const fontWeight = {
  light: '300' as const,
  regular: '400' as const,
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Enhanced typography system for minimalist design
export const typography = {
  h1: { fontSize: 32, fontWeight: '300' as const, lineHeight: 44, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '400' as const, lineHeight: 34, letterSpacing: -0.3 },
  h3: { fontSize: 20, fontWeight: '500' as const, lineHeight: 30 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 26 },
  caption: { fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
  small: { fontSize: 12, fontWeight: '400' as const, lineHeight: 18 },
} as const;

export const shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
    android: {
      elevation: 1,
    },
    default: {
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    },
  }),
  md: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
    },
    android: {
      elevation: 2,
    },
    default: {
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
    },
  }),
  lg: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
    default: {
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    },
  }),
  primary: Platform.select({
    ios: {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: {
      elevation: 3,
    },
    default: {
      boxShadow: `0 2px 8px ${colors.primary}22`,
    },
  }),
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.light,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },

  headerSubtitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  section: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },

  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },

  cardLight: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    backgroundColor: colors.white,
    color: colors.text.primary,
  },

  inputWithIcon: {
    paddingLeft: 44,
  },

  inputError: {
    borderColor: colors.status.error,
  },

  inputValid: {
    borderColor: colors.status.success,
  },

  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },

  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  errorText: {
    fontSize: fontSize.xs,
    color: colors.status.error,
    marginTop: spacing.xs,
  },

  button: {
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    ...shadows.primary,
  },

  buttonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.sm,
  },

  buttonSecondaryText: {
    color: colors.text.primary,
  },

  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.badge.background,
    alignSelf: 'flex-start',
  },

  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.badge.text,
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.md,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },

  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  separator: {
    height: 1,
    backgroundColor: colors.border.light,
  },

  placeholder: {
    width: 80,
    height: 80,
    backgroundColor: colors.border.light,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export const gradients = {
  primary: ['#FFF7ED', '#FFEDD5', '#FED7AA'] as const,
  light: ['#FFFFFF', '#F9FAFB'] as const,
};
