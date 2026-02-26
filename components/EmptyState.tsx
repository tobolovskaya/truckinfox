import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../lib/sharedStyles';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface EmptyStateAction {
  label: string;
  icon: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
}

export function EmptyState({ icon, title, description, actions }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={80} color={colors.text.tertiary} />
        </View>

        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Description */}
        <Text style={styles.description}>{description}</Text>

        {/* Actions */}
        {actions && actions.length > 0 && (
          <View style={styles.actionsContainer}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                onPress={action.onPress}
                style={[
                  styles.actionButton,
                  action.variant === 'secondary' && styles.actionButtonSecondary,
                ]}
                activeOpacity={0.7}
              >
                {action.variant === 'primary' ? (
                  <LinearGradient
                    colors={['#FF7043', '#FF8A65']}
                    style={styles.actionButtonGradient}
                  >
                    <Ionicons name={action.icon} size={20} color="white" />
                    <Text style={styles.actionButtonText}>{action.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.actionButtonSecondaryContent}>
                    <Ionicons name={action.icon} size={20} color={colors.primary} />
                    <Text style={styles.actionButtonSecondaryText}>{action.label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  actionsContainer: {
    width: '100%',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionButton: {
    width: '100%',
    height: 52,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: 'white',
  },
  actionButtonSecondary: {
    backgroundColor: colors.white,
  },
  actionButtonSecondaryContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionButtonSecondaryText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
});
