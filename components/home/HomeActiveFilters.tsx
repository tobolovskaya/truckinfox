import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../lib/sharedStyles';
import { useTranslation } from 'react-i18next';
import type { SortOption } from '../../hooks/useCargoRequests';

interface HomeActiveFiltersProps {
  sortBy: SortOption;
  selectedCargoType: string;
  onReset: () => void;
}

export const HomeActiveFilters: React.FC<HomeActiveFiltersProps> = ({
  sortBy,
  selectedCargoType,
  onReset,
}) => {
  const { t } = useTranslation();

  const hasActiveFilters = sortBy !== 'newest' || !!selectedCargoType;

  if (!hasActiveFilters) {
    return null;
  }

  return (
    <View style={styles.activeFilterRow}>
      {selectedCargoType ? (
        <View style={styles.activeFilterChip}>
          <Text style={styles.activeFilterChipText}>{t(selectedCargoType)}</Text>
        </View>
      ) : null}
      {sortBy !== 'newest' ? (
        <View style={styles.activeFilterChip}>
          <Text style={styles.activeFilterChipText}>{t(sortBy)}</Text>
        </View>
      ) : null}
      <TouchableOpacity
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel={t('resetFilters')}
      >
        <Text style={styles.clearFiltersText}>{t('resetFilters')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  activeFilterRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  activeFilterChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxxs,
  },
  activeFilterChipText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  clearFiltersText: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    fontWeight: fontWeight.semibold,
  },
});
