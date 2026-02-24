import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';
import { useTranslation } from 'react-i18next';

interface HomeTabBarProps {
  activeTab: 'all' | 'my';
  onTabChange: (_tab: 'all' | 'my') => void;
}

export const HomeTabBar: React.FC<HomeTabBarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.tabRow}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'all' && styles.tabButtonActive]}
        onPress={() => onTabChange('all')}
        accessibilityRole="button"
        accessibilityLabel={t('allRequests')}
      >
        <Text style={[styles.tabButtonText, activeTab === 'all' && styles.tabButtonTextActive]}>
          {t('allRequests')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'my' && styles.tabButtonActive]}
        onPress={() => onTabChange('my')}
        accessibilityRole="button"
        accessibilityLabel={t('myRequests')}
      >
        <Text style={[styles.tabButtonText, activeTab === 'my' && styles.tabButtonTextActive]}>
          {t('myRequests')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background,
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
    backgroundColor: colors.white,
  },
  tabButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
  tabButtonTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
});
