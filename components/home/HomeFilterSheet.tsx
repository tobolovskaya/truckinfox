import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
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
  priceMin: string;
  priceMax: string;
  priceType: string;
  weightMin: string;
  weightMax: string;
  pickupDateFrom: string;
  pickupDateTo: string;
  onPriceMinChange: (_v: string) => void;
  onPriceMaxChange: (_v: string) => void;
  onPriceTypeChange: (_v: string) => void;
  onWeightMinChange: (_v: string) => void;
  onWeightMaxChange: (_v: string) => void;
  onPickupDateFromChange: (_v: string) => void;
  onPickupDateToChange: (_v: string) => void;
}

const PRICE_TYPES = ['fixed', 'negotiable', 'auction'];

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
  priceMin,
  priceMax,
  priceType,
  weightMin,
  weightMax,
  pickupDateFrom,
  pickupDateTo,
  onPriceMinChange,
  onPriceMaxChange,
  onPriceTypeChange,
  onWeightMinChange,
  onWeightMaxChange,
  onPickupDateFromChange,
  onPickupDateToChange,
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
      {/* Sort */}
      <Text style={styles.sectionTitle}>{t('sortBy')}</Text>
      <View style={styles.chipRow}>
        {(['newest', 'priceLowToHigh', 'priceHighToLow', 'date'] as SortOption[]).map(option => {
          const selected = sortBy === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => onSortChange(option)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                {t(option)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'all' && (
        <>
          {/* Cargo type */}
          <Text style={styles.sectionTitle}>{t('cargoType')}</Text>
          <View style={[styles.chipRow, styles.chipWrap]}>
            <TouchableOpacity
              style={[styles.chip, !selectedCargoType && styles.chipActive]}
              onPress={() => onCargoTypeChange('')}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, !selectedCargoType && styles.chipTextActive]}>
                {t('allTypes')}
              </Text>
            </TouchableOpacity>
            {cargoTypes.map(type => {
              const selected = selectedCargoType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => onCargoTypeChange(type)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                    {t(type)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Price type */}
          <Text style={styles.sectionTitle}>{t('priceType')}</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !priceType && styles.chipActive]}
              onPress={() => onPriceTypeChange('')}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, !priceType && styles.chipTextActive]}>
                {t('allPriceTypes')}
              </Text>
            </TouchableOpacity>
            {PRICE_TYPES.map(pt => {
              const selected = priceType === pt;
              return (
                <TouchableOpacity
                  key={pt}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => onPriceTypeChange(pt)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                    {t(pt)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Price range */}
          <Text style={styles.sectionTitle}>{t('priceRange')} (NOK)</Text>
          <View style={styles.rangeRow}>
            <TextInput
              style={styles.rangeInput}
              value={priceMin}
              onChangeText={onPriceMinChange}
              placeholder={t('from') ?? 'Fra'}
              placeholderTextColor={colors.text.secondary}
              keyboardType="numeric"
              returnKeyType="done"
            />
            <Text style={styles.rangeSeparator}>—</Text>
            <TextInput
              style={styles.rangeInput}
              value={priceMax}
              onChangeText={onPriceMaxChange}
              placeholder={t('to') ?? 'Til'}
              placeholderTextColor={colors.text.secondary}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>

          {/* Weight range */}
          <Text style={styles.sectionTitle}>{t('weight')} (kg)</Text>
          <View style={styles.rangeRow}>
            <TextInput
              style={styles.rangeInput}
              value={weightMin}
              onChangeText={onWeightMinChange}
              placeholder={t('from') ?? 'Fra'}
              placeholderTextColor={colors.text.secondary}
              keyboardType="numeric"
              returnKeyType="done"
            />
            <Text style={styles.rangeSeparator}>—</Text>
            <TextInput
              style={styles.rangeInput}
              value={weightMax}
              onChangeText={onWeightMaxChange}
              placeholder={t('to') ?? 'Til'}
              placeholderTextColor={colors.text.secondary}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>

          {/* Pickup date range */}
          <Text style={styles.sectionTitle}>{t('pickupDate')}</Text>
          <View style={styles.rangeRow}>
            <TextInput
              style={styles.rangeInput}
              value={pickupDateFrom}
              onChangeText={onPickupDateFromChange}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.text.secondary}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              maxLength={10}
            />
            <Text style={styles.rangeSeparator}>—</Text>
            <TextInput
              style={styles.rangeInput}
              value={pickupDateTo}
              onChangeText={onPickupDateToChange}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.text.secondary}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              maxLength={10}
            />
          </View>
        </>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={onReset}
          accessibilityRole="button"
        >
          <Text style={styles.resetButtonText}>{t('resetFilters')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.applyButton}
          onPress={onClose}
          accessibilityRole="button"
        >
          <Text style={styles.applyButtonText}>{t('applyFilters')}</Text>
        </TouchableOpacity>
      </View>
    </StandardBottomSheet>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  chipWrap: {
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.backgroundVeryLight,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.semibold,
  },
  chipTextActive: {
    color: colors.white,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  rangeInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
    color: colors.text.primary,
    backgroundColor: colors.white,
  },
  rangeSeparator: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  resetButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: spacing.sm,
  },
  resetButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  applyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
  },
  applyButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});
