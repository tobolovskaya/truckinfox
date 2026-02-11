import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const triggerHapticFeedback = {
  light: () => {
    if (Platform.OS === 'ios') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.log('Haptic feedback not available:', error);
      }
    }
  },

  medium: () => {
    if (Platform.OS === 'ios') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (error) {
        console.log('Haptic feedback not available:', error);
      }
    }
  },

  heavy: () => {
    if (Platform.OS === 'ios') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch (error) {
        console.log('Haptic feedback not available:', error);
      }
    }
  },

  success: () => {
    if (Platform.OS === 'ios') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.log('Haptic feedback not available:', error);
      }
    }
  },

  warning: () => {
    if (Platform.OS === 'ios') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch (error) {
        console.log('Haptic feedback not available:', error);
      }
    }
  },

  error: () => {
    if (Platform.OS === 'ios') {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch (error) {
        console.log('Haptic feedback not available:', error);
      }
    }
  },

  selection: () => {
    if (Platform.OS === 'ios') {
      try {
        Haptics.selectionAsync();
      } catch (error) {
        console.log('Haptic feedback not available:', error);
      }
    }
  },
};
