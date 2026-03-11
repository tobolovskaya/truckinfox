import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTabletLayout, CONTENT_MAX_WIDTH } from '../lib/sharedStyles';

interface PageContainerProps {
  children: React.ReactNode;
  /** Override flex: 1 background container style */
  outerStyle?: StyleProp<ViewStyle>;
  /** Override the inner centered content style */
  innerStyle?: StyleProp<ViewStyle>;
}

/**
 * Wraps screen content so it:
 * - Takes up the full screen on phones
 * - Centers itself and caps width at CONTENT_MAX_WIDTH on tablets/iPads
 *
 * Usage: replace the root <View style={styles.container}> in a screen with
 * <PageContainer outerStyle={styles.container}>
 */
export function PageContainer({ children, outerStyle, innerStyle }: PageContainerProps) {
  const { isTablet } = useTabletLayout();

  if (!isTablet) {
    return <View style={[styles.fill, outerStyle]}>{children}</View>;
  }

  return (
    <View style={[styles.fill, outerStyle]}>
      <View style={[styles.centered, innerStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  centered: {
    flex: 1,
    maxWidth: CONTENT_MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
});
