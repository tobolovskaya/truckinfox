import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../lib/sharedStyles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;

interface SwipeAction {
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  color: string;
  onPress: () => void;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

export function SwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  onSwipeStart,
  onSwipeEnd,
}: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const rowRef = useRef<View>(null);
  const isSwipingRef = useRef(false);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      const { dx, dy } = gestureState;
      return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10;
    },

    onPanResponderGrant: () => {
      isSwipingRef.current = true;
      onSwipeStart?.();

      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },

    onPanResponderMove: (evt, gestureState) => {
      const { dx } = gestureState;
      let newTranslateX = dx;

      // Limit swipe distance
      const maxLeftSwipe = leftActions.length * 80;
      const maxRightSwipe = rightActions.length * 80;

      if (dx > 0) {
        // Swiping right (showing left actions)
        newTranslateX = Math.min(dx, maxLeftSwipe);
      } else {
        // Swiping left (showing right actions)
        newTranslateX = Math.max(dx, -maxRightSwipe);
      }

      translateX.setValue(newTranslateX);
    },

    onPanResponderRelease: (evt, gestureState) => {
      const { dx, vx } = gestureState;
      isSwipingRef.current = false;
      onSwipeEnd?.();

      let shouldStayOpen = false;
      let finalPosition = 0;

      // Determine if swipe should stay open based on distance or velocity
      if (dx > 0 && leftActions.length > 0) {
        // Right swipe
        if (Math.abs(dx) > SWIPE_THRESHOLD || vx > 0.5) {
          shouldStayOpen = true;
          finalPosition = Math.min(leftActions.length * 80, 120);
        }
      } else if (dx < 0 && rightActions.length > 0) {
        // Left swipe
        if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(vx) > 0.5) {
          shouldStayOpen = true;
          finalPosition = -Math.min(rightActions.length * 80, 120);
        }
      }

      // Animate to final position
      Animated.spring(translateX, {
        toValue: finalPosition,
        tension: 100,
        friction: 8,
        useNativeDriver: false,
      }).start();
    },
  });

  const closeRow = () => {
    Animated.spring(translateX, {
      toValue: 0,
      tension: 100,
      friction: 8,
      useNativeDriver: false,
    }).start();
  };

  const handleActionPress = (action: SwipeAction) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    closeRow();
    setTimeout(action.onPress, 150);
  };

  const renderActions = (actions: SwipeAction[], side: 'left' | 'right') => {
    if (actions.length === 0) return null;

    return (
      <View
        style={[
          styles.actionsContainer,
          side === 'left' ? styles.leftActions : styles.rightActions,
        ]}
      >
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.actionButton, { backgroundColor: action.backgroundColor }]}
            onPress={() => handleActionPress(action)}
            activeOpacity={0.7}
          >
            <Ionicons name={action.icon} size={22} color={action.color} style={styles.actionIcon} />
            <Text style={[styles.actionText, { color: action.color }]}>{action.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Left Actions */}
      {renderActions(leftActions, 'left')}

      {/* Right Actions */}
      {renderActions(rightActions, 'right')}

      {/* Main Content */}
      <Animated.View
        ref={rowRef}
        style={[
          styles.row,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  row: {
    backgroundColor: colors.white,
    zIndex: 1,
  },
  actionsContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 0,
  },
  leftActions: {
    left: 0,
  },
  rightActions: {
    right: 0,
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    paddingHorizontal: spacing.xs,
  },
  actionIcon: {
    marginBottom: spacing.xxs,
  },
  actionText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
});

// Pre-configured common actions
export const SwipeActions = {
  delete: (onPress: () => void): SwipeAction => ({
    text: 'Delete',
    icon: 'trash-outline',
    backgroundColor: '#FF3B30',
    color: 'white',
    onPress,
  }),

  archive: (onPress: () => void): SwipeAction => ({
    text: 'Archive',
    icon: 'archive-outline',
    backgroundColor: '#8E8E93',
    color: 'white',
    onPress,
  }),

  edit: (onPress: () => void): SwipeAction => ({
    text: 'Edit',
    icon: 'create-outline',
    backgroundColor: '#FF9500',
    color: 'white',
    onPress,
  }),

  complete: (onPress: () => void): SwipeAction => ({
    text: 'Complete',
    icon: 'checkmark-outline',
    backgroundColor: '#34C759',
    color: 'white',
    onPress,
  }),

  cancel: (onPress: () => void): SwipeAction => ({
    text: 'Cancel',
    icon: 'close-outline',
    backgroundColor: '#FF3B30',
    color: 'white',
    onPress,
  }),

  call: (onPress: () => void): SwipeAction => ({
    text: 'Call',
    icon: 'call-outline',
    backgroundColor: '#34C759',
    color: 'white',
    onPress,
  }),

  message: (onPress: () => void): SwipeAction => ({
    text: 'Message',
    icon: 'chatbubble-outline',
    backgroundcolor: colors.primary, // Primary orange
    color: 'white',
    onPress,
  }),
};

