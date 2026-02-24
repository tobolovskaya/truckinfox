import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '../lib/sharedStyles';
import { trackFilterApplied } from '../utils/analytics';
import { startTrace, PerformanceTraces } from '../utils/performance';

const SAVED_FILTERS_KEY = '@truckinfox_saved_filters';

export interface FilterOptions {
  sortBy: 'newest' | 'price_high' | 'price_low' | 'distance';
  cargoTypes: string[];
  priceRange: { min: number; max: number };
  dateRange?: { from: Date; to: Date };
  weightRange?: { min: number; max: number };
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: FilterOptions;
  createdAt: number;
}

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: (_filters: FilterOptions) => void;
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

  // Saved filters state
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');

  // Load saved filters from AsyncStorage
  useEffect(() => {
    loadSavedFilters();
  }, []);

  // Track filter sheet load performance
  useEffect(() => {
    if (visible) {
      const trace = startTrace(PerformanceTraces.FILTER_SHEET_LOAD);
      // Stop trace after a small delay to capture render time
      setTimeout(() => trace?.stop(), 100);
    }
  }, [visible]);

  const loadSavedFilters = async () => {
    try {
      const saved = await AsyncStorage.getItem(SAVED_FILTERS_KEY);
      if (saved) {
        setSavedFilters(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
  };

  const saveSavedFilters = async (filters: SavedFilter[]) => {
    try {
      await AsyncStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
      setSavedFilters(filters);
    } catch (error) {
      console.error('Error saving filters:', error);
      Alert.alert(t('error'), t('failedToSaveFilter'));
    }
  };

  const handleSaveFilter = () => {
    if (!filterName.trim()) {
      Alert.alert(t('error'), t('enterFilterName'));
      return;
    }

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName.trim(),
      filters: {
        sortBy,
        cargoTypes: selectedTypes,
        priceRange,
      },
      createdAt: Date.now(),
    };

    const updated = [...savedFilters, newFilter];
    saveSavedFilters(updated);
    setFilterName('');
    setShowSaveDialog(false);
    Alert.alert(t('success'), t('filterSaved'));
  };

  const handleLoadFilter = (savedFilter: SavedFilter) => {
    setSortBy(savedFilter.filters.sortBy);
    setSelectedTypes(savedFilter.filters.cargoTypes);
    setPriceRange(savedFilter.filters.priceRange);
    Alert.alert(t('success'), t('filterLoaded', { name: savedFilter.name }));
  };

  const handleDeleteFilter = (filterId: string) => {
    Alert.alert(t('deleteFilter'), t('confirmDeleteFilter'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          const updated = savedFilters.filter(f => f.id !== filterId);
          saveSavedFilters(updated);
        },
      },
    ]);
  };

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
            {/* Saved Filters Section */}
            {savedFilters.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('savedFilters')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.savedFiltersScroll}
                >
                  {savedFilters.map(savedFilter => (
                    <TouchableOpacity
                      key={savedFilter.id}
                      style={styles.savedFilterCard}
                      onPress={() => handleLoadFilter(savedFilter)}
                    >
                      <View style={styles.savedFilterHeader}>
                        <Ionicons name="bookmark" size={18} color={colors.primary} />
                        <Text style={styles.savedFilterName} numberOfLines={1}>
                          {savedFilter.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleDeleteFilter(savedFilter.id)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.savedFilterDetails}>
                        <Text style={styles.savedFilterDetail}>
                          {savedFilter.filters.cargoTypes.length} {t('types')}
                        </Text>
                        <Text style={styles.savedFilterDetailSeparator}>•</Text>
                        <Text style={styles.savedFilterDetail}>
                          {t(savedFilter.filters.sortBy)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

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
                      name={option.icon}
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
                      name={type.icon}
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
            <TouchableOpacity
              style={styles.saveFilterButton}
              onPress={() => setShowSaveDialog(true)}
            >
              <Ionicons name="bookmark-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>{t('applyFilters')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Filter Dialog */}
        <Modal visible={showSaveDialog} transparent animationType="fade">
          <View style={styles.dialogOverlay}>
            <View style={styles.dialogContent}>
              <Text style={styles.dialogTitle}>{t('saveCurrentFilter')}</Text>
              <TextInput
                style={styles.dialogInput}
                placeholder={t('enterFilterName')}
                placeholderTextColor={colors.text.tertiary}
                value={filterName}
                onChangeText={setFilterName}
                autoFocus
              />
              <View style={styles.dialogButtons}>
                <TouchableOpacity
                  style={styles.dialogButtonCancel}
                  onPress={() => {
                    setShowSaveDialog(false);
                    setFilterName('');
                  }}
                >
                  <Text style={styles.dialogButtonCancelText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dialogButtonSave} onPress={handleSaveFilter}>
                  <Text style={styles.dialogButtonSaveText}>{t('save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    backgroundColor: colors.white,
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
    backgroundColor: colors.white,
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
    backgroundColor: colors.white,
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
    flexDirection: 'row',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
  },
  saveFilterButton: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  applyButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...(shadows.md as Record<string, unknown>),
  },
  applyButtonText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: 'white',
  },
  savedFiltersScroll: {
    paddingRight: spacing.lg,
  },
  savedFilterCard: {
    minWidth: 160,
    marginRight: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.white,
    ...(shadows.sm as Record<string, unknown>),
  },
  savedFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  savedFilterName: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  savedFilterDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  savedFilterDetail: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },
  savedFilterDetailSeparator: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  dialogContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    ...(shadows.lg as Record<string, unknown>),
  },
  dialogTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  dialogInput: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dialogButtonCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
  },
  dialogButtonCancelText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  dialogButtonSave: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  dialogButtonSaveText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: 'white',
  },
});
