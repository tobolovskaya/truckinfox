import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';
import { useTranslation } from 'react-i18next';
import { TOUCH_TARGET } from '../../constants/touchTargets';

interface HomeTabBarProps {
  activeTab: 'all' | 'my';
  onTabChange: (_tab: 'all' | 'my') => void;
  myRequestsCount?: number;
}

export const HomeTabBar: React.FC<HomeTabBarProps> = ({
  activeTab,
  onTabChange,
  myRequestsCount = 0,
}) => {
  const { t } = useTranslation();
  const hasMyRequestsBadge = myRequestsCount > 0;

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
        <View style={styles.tabLabelRow}>
          <Text style={[styles.tabButtonText, activeTab === 'my' && styles.tabButtonTextActive]}>
            {t('myRequests')}
          </Text>
          {hasMyRequestsBadge ? (
            <View style={[styles.badge, activeTab === 'my' && styles.badgeActive]}>
              <Text style={[styles.badgeText, activeTab === 'my' && styles.badgeTextActive]}>
                {myRequestsCount > 99 ? '99+' : myRequestsCount}
              </Text>
            </View>
          ) : null}
        </View>
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
    minHeight: TOUCH_TARGET.MIN,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: spacing.xs,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: {
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  badgeTextActive: {
    color: colors.white,
  },
});
