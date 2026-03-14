import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../lib/sharedStyles';
import { useTranslation } from 'react-i18next';
import { TOUCH_TARGET } from '../../constants/touchTargets';

interface HomeSearchBarProps {
  searchQuery: string;
  onSearchChange: (_query: string) => void;
  isSearching?: boolean;
  hasActiveFilters: boolean;
  activeFilterCount?: number;
  onFilterPress: () => void;
}

export const HomeSearchBar: React.FC<HomeSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  isSearching = false,
  hasActiveFilters,
  activeFilterCount = 0,
  onFilterPress,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.searchRow}>
      <View style={styles.searchInputWrap}>
        <Ionicons name="search-outline" size={18} color={colors.text.secondary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={colors.text.secondary}
          returnKeyType="search"
        />
        {isSearching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>
      <TouchableOpacity
        style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
        onPress={onFilterPress}
        accessibilityRole="button"
        accessibilityLabel={t('filterAndSort')}
      >
        <Ionicons
          name="options-outline"
          size={20}
          color={hasActiveFilters ? colors.white : colors.text.primary}
        />
        {activeFilterCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {activeFilterCount > 9 ? '9+' : activeFilterCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET.MIN,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
    padding: 0,
  },
  filterButton: {
    minWidth: TOUCH_TARGET.MIN,
    minHeight: TOUCH_TARGET.MIN,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
    includeFontPadding: false,
  },
});
