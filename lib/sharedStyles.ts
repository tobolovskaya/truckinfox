import { StyleSheet, Platform } from 'react-native';
import { theme } from '../theme/theme';

export const colors = {
  primary: theme.colors.primary,
  primaryLight: theme.colors.primaryContainer,
  secondary: theme.colors.secondary,

  background: theme.colors.background,
  backgroundPrimary: theme.colors.background,
  backgroundLight: theme.colors.surfaceVariant,
  surface: theme.colors.surface,
  surfaceVariant: theme.colors.surfaceVariant,

  text: {
    primary: '#212121', // Updated to match ui.txt
    secondary: '#616161', // Updated to match ui.txt
    tertiary: '#9CA3AF',
    disabled: '#E0E0E0', // Updated to match ui.txt
    dark: '#212121',
  },

  border: {
    light: '#E0E0E0', // Updated to match ui.txt
    default: '#E0E0E0', // Updated to match ui.txt
    dark: '#9CA3AF',
    medium: '#E0E0E0', // Updated to match ui.txt
  },

  status: {
    success: theme.colors.tertiary,
    successBackground: theme.colors.tertiaryContainer,
    error: theme.colors.error,
    errorBackground: '#FEF2F2',
    warning: '#FFC107', // Updated to match ui.txt
    info: '#FF8A65', // Updated to match ui.txt (secondary orange)
  },

  // Add direct access to status colors
  error: theme.colors.error,
  success: theme.colors.tertiary,
  info: '#FF8A65', // Updated to match ui.txt

  badge: {
    background: '#F3F4F6',
    text: '#4B5563',
  },

  overlay: 'rgba(0, 0, 0, 0.5)',
  white: '#FFFFFF',
  black: '#000000',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12, // 8-12px as per ui.txt margin spec
  lg: 16, // Updated to match ui.txt padding spec
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 10, // Updated to match ui.txt button spec
  lg: 12, // Updated to match ui.txt card spec
  xl: 20,
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
  regular: '400' as const,
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 2,
    },
    default: {
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    },
  }),
  md: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: {
      elevation: 4,
    },
    default: {
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
    },
  }),
  lg: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
    },
    android: {
      elevation: 8,
    },
    default: {
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
    },
  }),
  primary: Platform.select({
    ios: {
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    android: {
      elevation: 8,
    },
    default: {
      boxShadow: `0 4px 8px ${colors.primary}33`,
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
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },

  headerSubtitle: {
    fontSize: fontSize.md,
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
    ...shadows.md,
  },

  cardLight: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
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
