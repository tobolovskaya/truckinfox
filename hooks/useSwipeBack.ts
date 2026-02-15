import { useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { runOnJS } from 'react-native-reanimated';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Custom hook for iOS-style edge swipe to go back
 * Provides intuitive navigation gesture for screen navigation
 *
 * @param enabled - Whether the swipe back gesture is enabled (default: true)
 * @param onSwipeStart - Optional callback when swipe starts
 * @param onSwipeEnd - Optional callback when swipe ends
 * @returns Gesture object to attach to GestureDetector
 *
 * @example
 * import { GestureDetector } from 'react-native-gesture-handler';
 *
 * const gesture = useSwipeBack();
 *
 * return (
 *   <GestureDetector gesture={gesture}>
 *     <View>{content}</View>
 *   </GestureDetector>
 * );
 */
export function useSwipeBack(
  enabled: boolean = true,
  onSwipeStart?: () => void,
  onSwipeEnd?: () => void
) {
  const router = useRouter();
  const startX = useRef(0);

  const triggerHaptic = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const goBack = () => {
    try {
      router.back();
    } catch (error) {
      console.warn('Navigation back failed:', error);
    }
  };

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([10, Number.MAX_SAFE_INTEGER]) // Only trigger for right swipes
    .onStart(event => {
      startX.current = event.x;

      // Only allow swipe from left edge (first 50pt)
      if (event.x <= 50) {
        runOnJS(triggerHaptic)();
        if (onSwipeStart) {
          runOnJS(onSwipeStart)();
        }
      }
    })
    .onEnd(event => {
      const distanceX = event.x - startX.current;

      // Swipe back if:
      // 1. Started from left edge (within 50pt)
      // 2. Swiped right more than 100pt OR fast velocity (> 500)
      if (startX.current <= 50 && (distanceX > 100 || event.velocityX > 500)) {
        runOnJS(goBack)();
      }

      if (onSwipeEnd) {
        runOnJS(onSwipeEnd)();
      }
    });

  return gesture;
}
