import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import { useToast } from '../contexts/ToastContext';
import { triggerHapticFeedback } from '../utils/haptics';
import { colors, spacing, fontSize } from '../lib/sharedStyles';

const CARGO_LIMITS = {
  weight: { min: 1, max: 25000 },
  dimension: { min: 1, max: 1200 },
  volume: { max: 40 },
} as const;

type FormData = {
  title: string;
  description: string;
  cargo_type: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  from_address: string;
  to_address: string;
  pickup_date: Date;
  delivery_date: Date;
  price_type: string;
  price: string;
  [key: string]: unknown;
};

const normalizeDateOnly = (value: Date) => {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export function useCargoFormValidation(formData: FormData) {
  const { t } = useTranslation();
  const toast = useToast();

  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [liveValidation, setLiveValidation] = useState(false);

  const validateField = (field: string, value: unknown, nextData: FormData = formData): string => {
    switch (field) {
      case 'title':
        if (!value || value.toString().trim() === '') return t('titleRequired');
        if (value.toString().trim().length < 3) return t('titleMinLength');
        return '';

      case 'description':
        if (!value || value.toString().trim() === '') return t('descriptionRequired');
        if (value.toString().trim().length < 10) return t('descriptionMinLength');
        return '';

      case 'cargo_type':
        if (!value) return t('cargoTypeRequired');
        return '';

      case 'weight': {
        if (!value || value.toString().trim() === '') return t('weightRequired');
        const weight = Number(value);
        if (isNaN(weight)) return t('weightMustBeNumber');
        if (weight <= 0) return t('weightMustBePositive');
        if (weight < CARGO_LIMITS.weight.min || weight > CARGO_LIMITS.weight.max) {
          return `Vekt må være mellom ${CARGO_LIMITS.weight.min} og ${CARGO_LIMITS.weight.max} kg`;
        }
        return '';
      }

      case 'length':
      case 'width':
      case 'height': {
        if (value && value.toString().trim()) {
          const dim = Number(value);
          if (isNaN(dim) || dim < CARGO_LIMITS.dimension.min || dim > CARGO_LIMITS.dimension.max) {
            return `Dimensjon må være mellom ${CARGO_LIMITS.dimension.min} og ${CARGO_LIMITS.dimension.max} cm`;
          }
        }
        return '';
      }

      case 'from_address':
        if (!value || !value.toString().trim()) return t('fromAddressRequired');
        if (value.toString().trim().length < 3) return t('fromAddressMinLength');
        return '';

      case 'to_address':
        if (!value || !value.toString().trim()) return t('toAddressRequired');
        if (value.toString().trim().length < 3) return t('toAddressMinLength');
        return '';

      case 'price_type':
        if (!value) return t('priceTypeRequired');
        return '';

      case 'price':
        if (nextData.price_type === 'fixed') {
          if (!value || value.toString().trim() === '') return t('priceRequired');
          const price = Number(value);
          if (isNaN(price)) return t('priceMustBeNumber');
          if (price <= 0) return t('priceMustBePositive');
          if (price > 1000000) return t('priceMaxExceeded');
        }
        return '';

      default:
        return '';
    }
  };

  const debouncedValidateField = useDebouncedCallback(
    (field: string, value: unknown, nextData: FormData) => {
      const error = validateField(field, value, nextData);
      setFieldErrors(prev => ({ ...prev, [field]: error }));
    },
    300
  );

  const handleBlur = (field: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field as keyof FormData]);
    setFieldErrors(prev => ({ ...prev, [field]: error }));
  };

  const validateDimensions = (): boolean => {
    const weight = Number(formData.weight);

    if (weight < CARGO_LIMITS.weight.min || weight > CARGO_LIMITS.weight.max) {
      toast.error(`Vekt må være mellom ${CARGO_LIMITS.weight.min} og ${CARGO_LIMITS.weight.max} kg`);
      triggerHapticFeedback.error();
      return false;
    }

    if (formData.length && formData.width && formData.height) {
      const length = Number(formData.length);
      const width = Number(formData.width);
      const height = Number(formData.height);

      for (const dim of [length, width, height]) {
        if (isNaN(dim) || dim < CARGO_LIMITS.dimension.min || dim > CARGO_LIMITS.dimension.max) {
          toast.error(`Dimensjoner må være mellom ${CARGO_LIMITS.dimension.min} og ${CARGO_LIMITS.dimension.max} cm`);
          triggerHapticFeedback.error();
          return false;
        }
      }

      const volume = (length * width * height) / 1000000;
      if (volume > CARGO_LIMITS.volume.max) {
        toast.error(`Lastevolum (${volume.toFixed(2)} m³) overstiger maksimum (${CARGO_LIMITS.volume.max} m³)`);
        triggerHapticFeedback.error();
        return false;
      }
    }

    return true;
  };

  const validateForm = (): boolean => {
    const fieldsToValidate = [
      'title', 'description', 'cargo_type', 'weight',
      'from_address', 'to_address', 'price_type', 'price',
    ];
    const newErrors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};

    fieldsToValidate.forEach(field => {
      newTouched[field] = true;
      const error = validateField(field, formData[field as keyof FormData]);
      if (error) newErrors[field] = error;
    });

    setTouchedFields(newTouched);
    setFieldErrors(newErrors);

    const firstError = Object.values(newErrors).find(e => e);
    if (firstError) {
      toast.error(firstError);
      triggerHapticFeedback.error();
      return false;
    }

    if (!validateDimensions()) return false;

    const pickupDate = normalizeDateOnly(formData.pickup_date);
    const deliveryDate = normalizeDateOnly(formData.delivery_date);
    if (deliveryDate.getTime() < pickupDate.getTime()) {
      toast.error(t('deliveryDateMustBeAfterPickup'));
      triggerHapticFeedback.error();
      return false;
    }

    return true;
  };

  const getValidationState = (field: string, value: unknown) => {
    const showValidation = liveValidation || Boolean(touchedFields[field]);
    const error = fieldErrors[field];
    const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
    const isValid = showValidation && !error && hasValue;
    return { showValidation, error, isValid };
  };

  const getInputValidationStyles = (field: string, value: unknown) => {
    const { showValidation, error, isValid } = getValidationState(field, value);
    return [showValidation && error && styles.textInputError, isValid && styles.textInputValid];
  };

  const getFieldError = (field: string, value: unknown): string | undefined => {
    const { showValidation, error } = getValidationState(field, value);
    return showValidation ? error : undefined;
  };

  const renderFieldError = (field: string, value: unknown): React.ReactNode => {
    const { showValidation, error } = getValidationState(field, value);
    if (!showValidation || !error) return null;
    return (
      React.createElement(View, { style: styles.errorContainer },
        React.createElement(Ionicons, { name: 'alert-circle', size: 16, color: colors.error }),
        React.createElement(Text, { style: styles.errorText }, error)
      )
    );
  };

  const renderValidIcon = (field: string, value: unknown): React.ReactNode => {
    const { isValid } = getValidationState(field, value);
    if (!isValid) return null;
    return React.createElement(Ionicons, {
      name: 'checkmark-circle',
      size: 18,
      color: colors.success,
      style: styles.validIcon,
    });
  };

  return {
    touchedFields,
    setTouchedFields,
    fieldErrors,
    setFieldErrors,
    liveValidation,
    setLiveValidation,
    validateField,
    validateDimensions,
    validateForm,
    debouncedValidateField,
    handleBlur,
    getValidationState,
    getInputValidationStyles,
    getFieldError,
    renderFieldError,
    renderValidIcon,
  };
}

const styles = StyleSheet.create({
  textInputError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  textInputValid: {
    borderColor: colors.success,
    borderWidth: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
  },
  validIcon: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
  },
});
