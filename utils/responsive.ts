import { useWindowDimensions } from 'react-native';
import { spacing } from '../lib/sharedStyles';

/**
 * Hook for responsive design utilities
 * Provides breakpoints and responsive value helpers
 */
export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  return {
    width,
    height,
    isSmallDevice: width < 375,
    isMediumDevice: width >= 375 && width < 768,
    isTablet: width >= 768,
    isLandscape: width > height,
    
    /**
     * Get responsive value based on screen size
     * @example
     * const padding = getResponsiveValue({ small: 8, medium: 16, large: 24 })
     */
    getResponsiveValue: <T,>(values: { small: T; medium: T; large: T }): T => {
      if (width < 375) return values.small;
      if (width < 768) return values.medium;
      return values.large;
    },
  };
};

/**
 * Helper to get spacing value with optional multiplier
 * @param size - Spacing size key
 * @param multiplier - Multiply spacing value
 * @example
 * paddingHorizontal: getSpacing('md', 2) // returns 24 (12 * 2)
 */
export const getSpacing = (size: keyof typeof spacing, multiplier = 1): number => {
  return spacing[size] * multiplier;
};
