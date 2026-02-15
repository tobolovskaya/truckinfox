/**
 * Mobile-First Design Constants
 * Based on Apple Human Interface Guidelines and Material Design
 */

/**
 * Minimum touch target size for interactive elements
 * iOS: 44pt x 44pt minimum (Apple HIG)
 * Android: 48dp x 48dp minimum (Material Design)
 *
 * Using 44pt as our standard to meet both platforms
 */
export const TOUCH_TARGET = {
  /** Minimum touch target size (44pt) */
  MIN: 44,
  /** Recommended touch target size (48pt) */
  COMFORTABLE: 48,
  /** Large touch target for important actions (56pt) */
  LARGE: 56,
} as const;

/**
 * HitSlop values for extending touch areas of small elements
 * Use when visual size must be smaller than minimum touch target
 *
 * @example
 * <TouchableOpacity hitSlop={HIT_SLOP.MEDIUM}>
 *   <Icon size={24} />
 * </TouchableOpacity>
 */
export const HIT_SLOP = {
  /** Small extension (8pt each side) - for slightly undersized elements */
  SMALL: { top: 8, bottom: 8, left: 8, right: 8 },
  /** Medium extension (12pt each side) - for icons and small buttons */
  MEDIUM: { top: 12, bottom: 12, left: 12, right: 12 },
  /** Large extension (16pt each side) - for very small interactive elements */
  LARGE: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;

/**
 * Thumb-friendly zones based on device ergonomics
 * One-handed phone usage natural thumb reach zones
 *
 * Reference: "Designing for Thumb Flow" by Luke Wroblewski
 */
export const THUMB_ZONES = {
  /**
   * Easy to reach - Bottom 1/3 of screen, center area
   * Place primary actions here (submit buttons, navigation)
   */
  EASY: 'bottom-center',
  /**
   * Stretch zone - Top corners, far edges
   * Place less frequent actions here (settings, secondary options)
   */
  STRETCH: 'top-corners',
  /**
   * Comfortable - Middle area, slight offset to dominant hand
   * Place frequently used actions here (tabs, common buttons)
   */
  COMFORTABLE: 'middle-center',
} as const;

/**
 * Recommended spacing around touch targets
 * Prevents accidental taps on adjacent elements
 */
export const TOUCH_SPACING = {
  /** Minimum spacing between interactive elements (8pt) */
  MIN: 8,
  /** Comfortable spacing for dense layouts (12pt) */
  COMFORTABLE: 12,
  /** Recommended spacing for important actions (16pt) */
  RECOMMENDED: 16,
} as const;

/**
 * Swipe gesture thresholds
 * Minimum distance/velocity to trigger swipe actions
 */
export const SWIPE = {
  /** Minimum distance to trigger swipe (80pt) */
  THRESHOLD: 80,
  /** Minimum velocity to trigger fast swipe (500 pt/s) */
  VELOCITY_THRESHOLD: 500,
  /** Edge detection zone for back gesture (50pt from left edge) */
  EDGE_ZONE: 50,
  /** Maximum swipe distance before capping (120pt) */
  MAX_DISTANCE: 120,
} as const;

/**
 * Helper function to ensure minimum touch target size
 *
 * @param size - Desired visual size
 * @param minSize - Minimum touch target (default: 44)
 * @returns Object with width, height, and optional hitSlop
 *
 * @example
 * const touchableStyle = ensureMinTouchTarget(32);
 * // Returns: { width: 32, height: 32, hitSlop: { top: 6, bottom: 6, left: 6, right: 6 } }
 */
export function ensureMinTouchTarget(
  size: number,
  minSize: number = TOUCH_TARGET.MIN
): {
  width: number;
  height: number;
  hitSlop?: { top: number; bottom: number; left: number; right: number };
} {
  if (size >= minSize) {
    return { width: size, height: size };
  }

  // Calculate hitSlop to extend touch area
  const extension = Math.ceil((minSize - size) / 2);

  return {
    width: size,
    height: size,
    hitSlop: {
      top: extension,
      bottom: extension,
      left: extension,
      right: extension,
    },
  };
}

/**
 * Check if a button should be positioned in thumb-friendly zone
 * Based on importance and frequency of use
 *
 * @param type - Button type ('primary', 'secondary', 'tertiary')
 * @param frequency - Usage frequency ('high', 'medium', 'low')
 * @returns Recommended zone
 */
export function getRecommendedZone(
  type: 'primary' | 'secondary' | 'tertiary',
  frequency: 'high' | 'medium' | 'low'
): string {
  if (type === 'primary' || frequency === 'high') {
    return THUMB_ZONES.EASY; // Bottom center - easiest to reach
  }

  if (type === 'secondary' || frequency === 'medium') {
    return THUMB_ZONES.COMFORTABLE; // Middle area
  }

  return THUMB_ZONES.STRETCH; // Top corners - stretch zone
}

/**
 * Constants for floating action buttons
 * Positioned in thumb-friendly bottom-right zone
 */
export const FAB = {
  /** Standard FAB size (56pt) */
  SIZE: 56,
  /** Mini FAB size (40pt) - use with hitSlop */
  SIZE_MINI: 40,
  /** Distance from bottom edge (16pt + safe area) */
  BOTTOM: 16,
  /** Distance from right edge (16pt) */
  RIGHT: 16,
  /** Distance between stacked FABs (16pt) */
  SPACING: 16,
} as const;

export default {
  TOUCH_TARGET,
  HIT_SLOP,
  THUMB_ZONES,
  TOUCH_SPACING,
  SWIPE,
  FAB,
  ensureMinTouchTarget,
  getRecommendedZone,
};
