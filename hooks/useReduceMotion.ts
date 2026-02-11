import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Hook to detect if the user has enabled "Reduce Motion" accessibility setting
 *
 * This hook respects the user's preference for reduced motion, which is important for:
 * - Users with vestibular disorders
 * - Users who experience motion sickness
 * - Users who find animations distracting
 *
 * When true, animations should be disabled or significantly reduced.
 *
 * @returns {boolean} Whether reduce motion is enabled
 */
export function useReduceMotion(): boolean {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    // Get initial state
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      setReduceMotionEnabled(enabled);
    });

    // Listen for changes
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled
    );

    // Cleanup
    return () => {
      subscription.remove();
    };
  }, []);

  return reduceMotionEnabled;
}
