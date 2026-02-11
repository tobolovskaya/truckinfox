import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Reanimated, { 
  useSharedValue, 
  useAnimatedStyle,
  withSpring,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  visible: boolean;
  message: string;
  type: ToastType;
  duration?: number;
  onHide?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ 
  visible, 
  message, 
  type, 
  duration = 3000,
  onHide 
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  
  useEffect(() => {
    if (visible) {
      // Show animation
      translateY.value = withSpring(0, { 
        damping: 15,
        stiffness: 150,
      });
      opacity.value = withTiming(1, { duration: 200 });
      
      // Auto hide after duration
      const hideAnimation = () => {
        translateY.value = withSpring(-100, { 
          damping: 20,
          stiffness: 200,
        });
        opacity.value = withTiming(0, { duration: 200 }, (finished) => {
          if (finished && onHide) {
            runOnJS(onHide)();
          }
        });
      };
      
      const timer = setTimeout(hideAnimation, duration);
      
      return () => clearTimeout(timer);
    } else {
      translateY.value = -100;
      opacity.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, duration, onHide]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));
  
  const icons: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
    success: 'checkmark-circle',
    error: 'close-circle',
    info: 'information-circle',
    warning: 'warning',
  };
  
  const toastColors: Record<ToastType, string> = {
    success: '#4CAF50',
    error: '#F44336',
    info: '#2196F3',
    warning: '#FF9800',
  };
  
  if (!visible && translateY.value === -100) return null;
  
  return (
    <Reanimated.View 
      style={[
        styles.toast, 
        animatedStyle, 
        { 
          backgroundColor: toastColors[type],
          top: insets.top + 10,
        }
      ]}
    >
      <View style={styles.toastContent}>
        <Ionicons name={icons[type]} size={24} color="white" />
        <Text style={styles.message} numberOfLines={2}>{message}</Text>
      </View>
      {onHide && (
        <Pressable onPress={onHide} hitSlop={8}>
          <Ionicons name="close" size={20} color="white" />
        </Pressable>
      )}
    </Reanimated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  message: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
});
