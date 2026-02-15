import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

interface SuccessAnimationProps {
  visible: boolean;
  type?: 'checkmark' | 'confetti';
  onAnimationEnd?: () => void;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
  visible,
  type = 'checkmark',
  onAnimationEnd,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Checkmark animation sequence
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.elastic(1),
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        scaleAnim.setValue(0);
        rotateAnim.setValue(0);
        onAnimationEnd?.();
      });
    }
  }, [visible]);

  if (!visible) return null;

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ scale: scaleAnim }, { rotate }],
            opacity: opacityAnim,
          },
        ]}
      >
        <View style={styles.circle}>
          <Ionicons
            name={type === 'checkmark' ? 'checkmark-circle' : 'sparkles'}
            size={80}
            color={theme.iconColors.white}
          />
        </View>
      </Animated.View>

      {type === 'confetti' && visible && <ConfettiParticles />}
    </View>
  );
};

const ConfettiParticles: React.FC = () => {
  const particles = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    anim: useRef(new Animated.Value(0)).current,
    x: Math.random() * 300 - 150,
    y: Math.random() * -100 - 50,
    color: ['#FF7043', '#4CAF50', '#2196F3', '#FFC107', '#E91E63'][
      Math.floor(Math.random() * 5)
    ],
    size: Math.random() * 6 + 4,
  }));

  useEffect(() => {
    Animated.stagger(
      30,
      particles.map((p) =>
        Animated.timing(p.anim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  return (
    <>
      {particles.map((p) => {
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [p.y, 400],
        });

        const opacity = p.anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1, 0],
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                backgroundColor: p.color,
                width: p.size,
                height: p.size,
                transform: [{ translateX: p.x }, { translateY }],
                opacity,
              },
            ]}
          />
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    pointerEvents: 'none',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.shadows.default.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  particle: {
    position: 'absolute',
    borderRadius: 10,
  },
});
