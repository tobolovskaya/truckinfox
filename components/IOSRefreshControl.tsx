import React, { useEffect, useRef } from 'react';
import {
  Animated,
  RefreshControl,
  RefreshControlProps,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../lib/sharedStyles';

interface IOSRefreshControlProps extends Omit<RefreshControlProps, 'colors' | 'tintColor'> {
  onRefresh: () => void;
  refreshing: boolean;
  tintColor?: string;
}

export function IOSRefreshControl({
  onRefresh,
  refreshing,
  tintColor = '#FF7043',
  ...props
}: IOSRefreshControlProps) {
  const previousRefreshing = useRef(refreshing);

  useEffect(() => {
    // Add haptic feedback when refresh starts
    if (Platform.OS === 'ios' && refreshing && !previousRefreshing.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    previousRefreshing.current = refreshing;
  }, [refreshing]);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={tintColor}
      titleColor="#8E8E93"
      {...(Platform.OS === 'android' && {
        colors: [tintColor],
        progressBackgroundColor: '#FFFFFF',
      })}
      {...props}
    />
  );
}