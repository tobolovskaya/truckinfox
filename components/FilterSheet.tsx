import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../lib/sharedStyles';
import { trackFilterApplied } from '../utils/analytics';
import { startTrace, PerformanceTraces } from '../utils/performance';

export interface FilterOptions {
  sortBy: 'newest' | 'price_high' | 'price_low' | 'distance';
  cargoTypes: string[];
  priceRange: { min: number; max: number };
  dateRange?: { from: Date; to: Date };
  weightRange?: { min: number; max: number };
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
  initialFilters?: FilterOptions;
}

const CARGO_TYPES = [
  { id: 'automotive', label: 'Bil/Motor', icon: 'car' },
  { id: 'construction', label: 'Byggemateriale', icon: 'construct' },
  { id: 'boats', label: 'Båter', icon: 'boat' },
  { id: 'electronics', label: 'Elektronikk', icon: 'phone-portrait' },
  { id: 'campingvogn', label: 'Campingvogn', icon: 'home' },
  { id: 'machinery', label: 'Maskineri', icon: 'build' },
  { id: 'furniture', label: 'Møbler', icon: 'bed' },
  { id: 'other', label: 'Annet', icon: 'cube' },
];

const SORT_OPTIONS = [
  { id: 'newest', label: 'Nyeste først', icon: 'time' },
  { id: 'price_high', label: 'Høyeste pris', icon: 'arrow-up' },
  { id: 'price_low', label: 'Laveste pris', icon: 'arrow-down' },
  { id: 'distance', label: 'Nærmeste', icon: 'location' },
];

export const FilterSheet: React.FC<FilterSheetProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters,
}) => {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<FilterOptions['sortBy']>(initialFilters?.sortBy || 'newest');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialFilters?.cargoTypes || []);
  const [priceRange, setPriceRange] = useState(
    initialFilters?.priceRange || { min: 0, max: 50000 }
  );

  // Track filter sheet load performance
  useEffect(() => {
    if (visible) {
      const trace = startTrace(PerformanceTraces.FILTER_SHEET_LOAD);
      // Stop trace after a small delay to capture render time
      setTimeout(() => trace?.stop(), 100);
    }
  }, [visible]);

  const toggleCargoType = (typeId: string) => {
    setSelectedTypes(prev =>
      prev.includes(typeId) ? prev.filter(t => t !== typeId) : [...prev, typeId]
    );
  };

  const handleApply = () => {
    // Track analytics
    trackFilterApplied({
      sort_by: sortBy,
      cargo_types_count: selectedTypes.length,
      price_range: `${priceRange.min}-${priceRange.max}`,
    });

    onApply({
      sortBy,
      cargoTypes: selectedTypes,
      priceRange,
    });
    onClose();
  };

  const handleReset = () => {
    setSortBy('newest');
    setSelectedTypes([]);
    setPriceRange({ min: 0, max: 50000 });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('filterAndSort')}</Text>
            <TouchableOpacity onPress={handleReset}>
              <Text style={styles.resetText}>{t('resetFilters')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Sort Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('sortBy')}</Text>
              <View style={styles.optionsGrid}>
                {SORT_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.sortOption, sortBy === option.id && styles.sortOptionActive]}
                    onPress={() => setSortBy(option.id as FilterOptions['sortBy'])}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={sortBy === option.id ? 'white' : colors.primary}
                    />
                    <Text
                      style={[
                        styles.sortOptionText,
                        sortBy === option.id && styles.sortOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Cargo Types */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('cargoType')}</Text>
              <View style={styles.chipsContainer}>
                {CARGO_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.chip, selectedTypes.includes(type.id) && styles.chipActive]}
                    onPress={() => toggleCargoType(type.id)}
                  >
                    <Ionicons
                      name={type.icon as any}
                      size={18}
                      color={selectedTypes.includes(type.id) ? 'white' : colors.primary}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        selectedTypes.includes(type.id) && styles.chipTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Price Range */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('priceRange')}</Text>
              <View style={styles.priceRange}>
                <View style={styles.priceInput}>
                  <Text style={styles.priceLabel}>{t('from')}</Text>
                  <Text style={styles.priceValue}>{priceRange.min} NOK</Text>
                </View>
                <Text style={styles.priceSeparator}>-</Text>
                <View style={styles.priceInput}>
                  <Text style={styles.priceLabel}>{t('to')}</Text>
                  <Text style={styles.priceValue}>{priceRange.max} NOK</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Apply Button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>{t('applyFilters')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  resetText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'white',
  },
  sortOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortOptionText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  sortOptionTextActive: {
    color: 'white',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    backgroundColor: 'white',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  chipTextActive: {
    color: 'white',
  },
  priceRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  priceInput: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  priceLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  priceValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  priceSeparator: {
    fontSize: fontSize.lg,
    color: colors.text.tertiary,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  applyButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...(shadows.md as any),
  },
  applyButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: 'white',
  },
});
