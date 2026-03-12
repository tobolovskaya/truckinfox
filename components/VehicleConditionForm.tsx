import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fontSize, borderRadius } from '../lib/sharedStyles';

type Props = {
  isSmallScreen: boolean;
  isDriveable: boolean;
  onSetIsDriveable: (v: boolean) => void;
  vehicleStarts: boolean;
  onSetVehicleStarts: (v: boolean) => void;
  vehicleHasDamage: boolean;
  onSetVehicleHasDamage: (v: boolean) => void;
  vehicleVin: string;
  onSetVehicleVin: (v: string) => void;
  vehicleHasKeys: boolean;
  onSetVehicleHasKeys: (v: boolean) => void;
  vehicleHasWheelLock: boolean;
  onSetVehicleHasWheelLock: (v: boolean) => void;
  vehicleGroundClearanceCm: string;
  onSetVehicleGroundClearanceCm: (v: string) => void;
  vehicleNeedsWinch: boolean;
  onSetVehicleNeedsWinch: (v: boolean) => void;
  transportType: 'open' | 'enclosed';
  onSetTransportType: (v: 'open' | 'enclosed') => void;
};

export function VehicleConditionForm({
  isSmallScreen,
  isDriveable, onSetIsDriveable,
  vehicleStarts, onSetVehicleStarts,
  vehicleHasDamage, onSetVehicleHasDamage,
  vehicleVin, onSetVehicleVin,
  vehicleHasKeys, onSetVehicleHasKeys,
  vehicleHasWheelLock, onSetVehicleHasWheelLock,
  vehicleGroundClearanceCm, onSetVehicleGroundClearanceCm,
  vehicleNeedsWinch, onSetVehicleNeedsWinch,
  transportType, onSetTransportType,
}: Props) {
  const { t } = useTranslation();

  return (
    <View style={[styles.fieldContainer, isSmallScreen && styles.fieldContainerCompact]}>
      <Text style={[styles.fieldLabel, isSmallScreen && styles.fieldLabelCompact]}>
        {t('vehicleCondition')}
      </Text>
      <View style={styles.vehicleConditionCard}>

        {/* Q1: Is it driveable? */}
        <View style={styles.vehicleConditionRow}>
          <View style={styles.vehicleConditionTextWrap}>
            <Text style={styles.vehicleConditionQuestion}>{t('vehicleIsDriveable')}</Text>
            <Text style={styles.vehicleConditionHint}>{t('vehicleIsDriveableHint')}</Text>
          </View>
          <View style={styles.vehicleConditionToggleRow}>
            <TouchableOpacity
              style={[styles.conditionPill, isDriveable && styles.conditionPillActive]}
              onPress={() => onSetIsDriveable(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, isDriveable && styles.conditionPillTextActive]}>
                {t('yes')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.conditionPill, !isDriveable && styles.conditionPillActiveNo]}
              onPress={() => onSetIsDriveable(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, !isDriveable && styles.conditionPillTextActive]}>
                {t('no')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.vehicleConditionDivider} />

        {/* Q2: Does it start? */}
        <View style={styles.vehicleConditionRow}>
          <View style={styles.vehicleConditionTextWrap}>
            <Text style={styles.vehicleConditionQuestion}>{t('vehicleStarts')}</Text>
            <Text style={styles.vehicleConditionHint}>{t('vehicleStartsHint')}</Text>
          </View>
          <View style={styles.vehicleConditionToggleRow}>
            <TouchableOpacity
              style={[styles.conditionPill, vehicleStarts && styles.conditionPillActive]}
              onPress={() => onSetVehicleStarts(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, vehicleStarts && styles.conditionPillTextActive]}>
                {t('yes')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.conditionPill, !vehicleStarts && styles.conditionPillActiveNo]}
              onPress={() => onSetVehicleStarts(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, !vehicleStarts && styles.conditionPillTextActive]}>
                {t('no')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.vehicleConditionDivider} />

        {/* Q3: Has visible damage? */}
        <View style={styles.vehicleConditionRow}>
          <View style={styles.vehicleConditionTextWrap}>
            <Text style={styles.vehicleConditionQuestion}>{t('vehicleHasDamage')}</Text>
            <Text style={styles.vehicleConditionHint}>{t('vehicleHasDamageHint')}</Text>
          </View>
          <View style={styles.vehicleConditionToggleRow}>
            <TouchableOpacity
              style={[styles.conditionPill, vehicleHasDamage && styles.conditionPillActiveNo]}
              onPress={() => onSetVehicleHasDamage(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, vehicleHasDamage && styles.conditionPillTextActive]}>
                {t('yes')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.conditionPill, !vehicleHasDamage && styles.conditionPillActive]}
              onPress={() => onSetVehicleHasDamage(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, !vehicleHasDamage && styles.conditionPillTextActive]}>
                {t('no')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.vehicleConditionDivider} />

        {/* Transport type */}
        <View style={styles.vehicleConditionRowStacked}>
          <Text style={styles.vehicleConditionQuestion}>{t('transportType')}</Text>
          <Text style={styles.vehicleConditionHint}>{t('transportTypeHint')}</Text>
          <View style={styles.transportTypeRow}>
            <TouchableOpacity
              style={[styles.transportTypePill, transportType === 'open' && styles.conditionPillActive]}
              onPress={() => onSetTransportType('open')}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, transportType === 'open' && styles.conditionPillTextActive]}>
                {t('openTrailer')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.transportTypePill, transportType === 'enclosed' && styles.conditionPillActive]}
              onPress={() => onSetTransportType('enclosed')}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, transportType === 'enclosed' && styles.conditionPillTextActive]}>
                {t('enclosedTrailer')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.vehicleConditionDivider} />

        {/* VIN */}
        <View style={styles.vehicleConditionRowStacked}>
          <Text style={styles.vehicleConditionQuestion}>{t('vinOptional')}</Text>
          <TextInput
            style={styles.vehicleMetaInput}
            value={vehicleVin}
            onChangeText={onSetVehicleVin}
            autoCapitalize="characters"
            placeholder="e.g. YV1TS..."
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.vehicleConditionDivider} />

        {/* Ground clearance */}
        <View style={styles.vehicleConditionRowStacked}>
          <Text style={styles.vehicleConditionQuestion}>{t('groundClearanceCm')}</Text>
          <TextInput
            style={styles.vehicleMetaInput}
            value={vehicleGroundClearanceCm}
            onChangeText={onSetVehicleGroundClearanceCm}
            keyboardType="numeric"
            placeholder="e.g. 14"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.vehicleConditionDivider} />

        {/* Keys included */}
        <View style={styles.vehicleConditionRow}>
          <View style={styles.vehicleConditionTextWrap}>
            <Text style={styles.vehicleConditionQuestion}>{t('keysIncluded')}</Text>
          </View>
          <View style={styles.vehicleConditionToggleRow}>
            <TouchableOpacity
              style={[styles.conditionPill, vehicleHasKeys && styles.conditionPillActive]}
              onPress={() => onSetVehicleHasKeys(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, vehicleHasKeys && styles.conditionPillTextActive]}>{t('yes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.conditionPill, !vehicleHasKeys && styles.conditionPillActiveNo]}
              onPress={() => onSetVehicleHasKeys(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, !vehicleHasKeys && styles.conditionPillTextActive]}>{t('no')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.vehicleConditionDivider} />

        {/* Wheel lock */}
        <View style={styles.vehicleConditionRow}>
          <View style={styles.vehicleConditionTextWrap}>
            <Text style={styles.vehicleConditionQuestion}>{t('wheelLock')}</Text>
          </View>
          <View style={styles.vehicleConditionToggleRow}>
            <TouchableOpacity
              style={[styles.conditionPill, vehicleHasWheelLock && styles.conditionPillActiveNo]}
              onPress={() => onSetVehicleHasWheelLock(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, vehicleHasWheelLock && styles.conditionPillTextActive]}>{t('yes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.conditionPill, !vehicleHasWheelLock && styles.conditionPillActive]}
              onPress={() => onSetVehicleHasWheelLock(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, !vehicleHasWheelLock && styles.conditionPillTextActive]}>{t('no')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.vehicleConditionDivider} />

        {/* Needs winch */}
        <View style={styles.vehicleConditionRow}>
          <View style={styles.vehicleConditionTextWrap}>
            <Text style={styles.vehicleConditionQuestion}>{t('needsWinch')}</Text>
          </View>
          <View style={styles.vehicleConditionToggleRow}>
            <TouchableOpacity
              style={[styles.conditionPill, vehicleNeedsWinch && styles.conditionPillActiveNo]}
              onPress={() => onSetVehicleNeedsWinch(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, vehicleNeedsWinch && styles.conditionPillTextActive]}>{t('yes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.conditionPill, !vehicleNeedsWinch && styles.conditionPillActive]}
              onPress={() => onSetVehicleNeedsWinch(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.conditionPillText, !vehicleNeedsWinch && styles.conditionPillTextActive]}>{t('no')}</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldContainer: {
    marginBottom: spacing.xxl,
  },
  fieldContainerCompact: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#111827',
    marginBottom: spacing.xs,
  },
  fieldLabelCompact: {
    fontSize: fontSize.sm,
  },
  vehicleConditionCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginTop: spacing.xs,
  },
  vehicleConditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },
  vehicleConditionTextWrap: {
    flex: 1,
  },
  vehicleConditionQuestion: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#111827',
  },
  vehicleConditionHint: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    marginTop: 2,
  },
  vehicleConditionToggleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  vehicleConditionRowStacked: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  vehicleConditionDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: spacing.md,
  },
  conditionPill: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: '#F9FAFB',
    minWidth: 48,
    alignItems: 'center',
  },
  conditionPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  conditionPillActiveNo: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  conditionPillText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#6B7280',
  },
  conditionPillTextActive: {
    color: '#111827',
  },
  transportTypeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  transportTypePill: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  vehicleMetaInput: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
    backgroundColor: colors.white,
  },
});
