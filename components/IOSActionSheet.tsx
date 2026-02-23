import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme/theme';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../lib/sharedStyles';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface IOSActionSheetOption {
  title: string;
  onPress: () => void;
  icon?: string;
  destructive?: boolean;
  disabled?: boolean;
}

interface IOSActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  options: IOSActionSheetOption[];
  cancelText?: string;
}

export function IOSActionSheet({
  visible,
  onClose,
  title,
  message,
  options,
  cancelText = 'Cancel',
}: IOSActionSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide animation
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: SCREEN_HEIGHT,
          tension: 120,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleOptionPress = (option: IOSActionSheetOption) => {
    if (option.disabled) return;

    // Add haptic feedback
    if (Platform.OS === 'ios') {
      const feedback = option.destructive
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(feedback);
    }

    onClose();
    // Delay the action slightly to allow the sheet to close
    setTimeout(option.onPress, 150);
  };

  const handleCancel = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  const handleBackdropPress = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleBackdropPress}>
          <Animated.View
            style={[
              styles.backdropOverlay,
              {
                opacity: opacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.4],
                }),
              },
            ]}
          />
        </TouchableOpacity>

        {/* Action Sheet */}
        <Animated.View
          style={[
            styles.actionSheet,
            {
              paddingBottom: insets.bottom + 8,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Header */}
          {(title || message) && (
            <View style={styles.header}>
              {title && <Text style={styles.title}>{title}</Text>}
              {message && <Text style={styles.message}>{message}</Text>}
            </View>
          )}

          {/* Options */}
          <View style={styles.optionsContainer}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.option,
                  index === 0 && styles.firstOption,
                  index === options.length - 1 && styles.lastOption,
                  option.disabled && styles.disabledOption,
                ]}
                onPress={() => handleOptionPress(option)}
                disabled={option.disabled}
                activeOpacity={0.6}
              >
                <View style={styles.optionContent}>
                  {option.icon && (
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={
                        option.disabled
                          ? theme.iconColors.ios.lightGray
                          : option.destructive
                            ? theme.iconColors.ios.red
                            : theme.iconColors.ios.blue
                      }
                      style={styles.optionIcon}
                    />
                  )}
                  <Text
                    style={[
                      styles.optionText,
                      option.destructive && styles.destructiveText,
                      option.disabled && styles.disabledText,
                    ]}
                  >
                    {option.title}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cancel Button */}
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.6}>
            <Text style={styles.cancelText}>{cancelText}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
  },
  backdropOverlay: {
    flex: 1,
    backgroundColor: colors.black,
  },
  actionSheet: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  header: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: theme.iconColors.ios.gray,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    color: theme.iconColors.ios.gray,
    textAlign: 'center',
    lineHeight: 18,
  },
  optionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  option: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(60, 60, 67, 0.36)',
  },
  firstOption: {},
  lastOption: {
    borderBottomWidth: 0,
  },
  disabledOption: {
    opacity: 0.4,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIcon: {
    marginRight: spacing.md,
  },
  optionText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.regular,
    color: theme.iconColors.ios.blue,
    textAlign: 'center',
  },
  destructiveText: {
    color: theme.iconColors.ios.red,
  },
  disabledText: {
    color: theme.iconColors.ios.lightGray,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: theme.iconColors.ios.blue,
    textAlign: 'center',
  },
});

// Helper function to show action sheet
export const showActionSheet = (options: {
  title?: string;
  message?: string;
  options: IOSActionSheetOption[];
  cancelText?: string;
}) => {
  // This would typically be implemented with a context provider
  // For now, it's a placeholder for the API we want
  console.log('Action sheet options:', options);
};
