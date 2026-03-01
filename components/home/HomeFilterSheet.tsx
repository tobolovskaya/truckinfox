import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../lib/sharedStyles';
import { useTranslation } from 'react-i18next';
import type { SortOption } from '../../hooks/useCargoRequests';
import { StandardBottomSheet } from '../StandardBottomSheet';

interface HomeFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  activeTab: 'all' | 'my';
  sortBy: SortOption;
  selectedCargoType: string;
  onSortChange: (_sort: SortOption) => void;
  onCargoTypeChange: (_type: string) => void;
  onReset: () => void;
  cargoTypes: string[];
}

export const HomeFilterSheet: React.FC<HomeFilterSheetProps> = ({
  visible,
  onClose,
  activeTab,
  sortBy,
  selectedCargoType,
  onSortChange,
  onCargoTypeChange,
  onReset,
  cargoTypes,
}) => {
  const { t } = useTranslation();

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('filterAndSort')}
      headerRight={
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('cancel')}
        >
          <Ionicons name="close" size={22} color={colors.text.primary} />
        </TouchableOpacity>
      }
    >
      <Text style={styles.sheetSectionTitle}>{t('sortBy')}</Text>
      <View style={styles.sheetOptionsRow}>
        {(['newest', 'priceLowToHigh', 'priceHighToLow'] as SortOption[]).map(option => {
          const selected = sortBy === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.sheetOption, selected && styles.sheetOptionActive]}
              onPress={() => onSortChange(option)}
              accessibilityRole="button"
              accessibilityLabel={t(option)}
            >
              <Text style={[styles.sheetOptionText, selected && styles.sheetOptionTextActive]}>
                {t(option)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'all' && (
        <>
          <Text style={styles.sheetSectionTitle}>{t('cargoType')}</Text>
          <View style={[styles.sheetOptionsRow, styles.sheetOptionsWrap]}>
            <TouchableOpacity
              style={[styles.sheetOption, !selectedCargoType && styles.sheetOptionActive]}
              onPress={() => onCargoTypeChange('')}
              accessibilityRole="button"
              accessibilityLabel={t('allTypes')}
            >
              <Text
                style={[styles.sheetOptionText, !selectedCargoType && styles.sheetOptionTextActive]}
              >
                {t('allTypes')}
              </Text>
            </TouchableOpacity>
            {cargoTypes.map(type => {
              const selected = selectedCargoType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.sheetOption, selected && styles.sheetOptionActive]}
                  onPress={() => onCargoTypeChange(type)}
                  accessibilityRole="button"
                  accessibilityLabel={t(type)}
                >
                  <Text style={[styles.sheetOptionText, selected && styles.sheetOptionTextActive]}>
                    {t(type)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.sheetActions}>
        <TouchableOpacity
          style={styles.sheetSecondaryButton}
          onPress={onReset}
          accessibilityRole="button"
          accessibilityLabel={t('resetFilters')}
        >
          <Text style={styles.sheetSecondaryButtonText}>{t('resetFilters')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sheetPrimaryButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('save')}
        >
          <Text style={styles.sheetPrimaryButtonText}>{t('save')}</Text>
        </TouchableOpacity>
      </View>
    </StandardBottomSheet>
  );
};

const styles = StyleSheet.create({
  sheetSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sheetOptionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  sheetOptionsWrap: {
    flexWrap: 'wrap',
  },
  sheetOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.backgroundVeryLight,
  },
  sheetOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sheetOptionText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.semibold,
  },
  sheetOptionTextActive: {
    color: colors.white,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  sheetSecondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: spacing.sm,
  },
  sheetSecondaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  sheetPrimaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
  },
  sheetPrimaryButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});
