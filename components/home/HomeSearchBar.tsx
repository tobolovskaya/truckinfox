import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../lib/sharedStyles';
import { useTranslation } from 'react-i18next';
import { TOUCH_TARGET } from '../../constants/touchTargets';

interface HomeSearchBarProps {
  searchQuery: string;
  onSearchChange: (_query: string) => void;
  isSearching?: boolean;
  hasActiveFilters: boolean;
  onFilterPress: () => void;
}

export const HomeSearchBar: React.FC<HomeSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  isSearching = false,
  hasActiveFilters,
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
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET.MIN,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
