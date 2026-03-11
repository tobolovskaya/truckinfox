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
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'all' && styles.tabButtonActive]}
          onPress={() => onTabChange('all')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'all' }}
          accessibilityLabel={t('allRequests')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'all' && styles.tabButtonTextActive]}>
            {t('allRequests')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'my' && styles.tabButtonActive]}
          onPress={() => onTabChange('my')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'my' }}
          accessibilityLabel={t('myRequests')}
        >
          <View style={styles.tabLabelRow}>
            <Text style={[styles.tabButtonText, activeTab === 'my' && styles.tabButtonTextActive]}>
              {t('myRequests')}
            </Text>
            {hasMyRequestsBadge && (
              <View style={[styles.badge, activeTab === 'my' && styles.badgeActive]}>
                <Text style={[styles.badgeText, activeTab === 'my' && styles.badgeTextActive]}>
                  {myRequestsCount > 99 ? '99+' : myRequestsCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  tabButton: {
    flex: 1,
    minHeight: TOUCH_TARGET.MIN - 4,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: '#6B7280',
  },
  tabButtonTextActive: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing.xxxs,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: {
    backgroundColor: colors.primaryLight,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: '#6B7280',
  },
  badgeTextActive: {
    color: colors.primary,
  },
});
