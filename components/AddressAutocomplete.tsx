import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { borderRadius, colors, fontSize, fontWeight, shadows, spacing } from '../lib/sharedStyles';

interface AddressAutocompleteProps {
  value: string;
  onSelect: (address: string, lat?: number, lng?: number) => void;
  onChangeText?: (text: string) => void;
  placeholder: string;
  label: string;
  error?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onSelect,
  onChangeText,
  placeholder,
  label,
  error,
}) => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <GooglePlacesAutocomplete
        placeholder={placeholder}
        fetchDetails
        onPress={(data, details = null) => {
          const location = details?.geometry?.location;
          if (location) {
            onSelect(data.description, location.lat, location.lng);
          } else {
            onSelect(data.description);
          }
        }}
        query={{
          key: apiKey,
          language: 'no',
          components: 'country:no',
        }}
        styles={{
          textInput: [styles.input, error && styles.inputError],
          container: styles.autocompleteContainer,
          listView: styles.listView,
          row: styles.row,
        }}
        textInputProps={{
          value,
          onChangeText: text => onChangeText?.(text),
          placeholderTextColor: colors.text.tertiary,
          autoCorrect: false,
          autoCapitalize: 'words',
        }}
        renderRow={rowData => (
          <View style={styles.rowContent}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <Text style={styles.rowText}>{rowData.description}</Text>
          </View>
        )}
        enablePoweredByContainer={false}
        debounce={300}
      />

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  autocompleteContainer: {
    flex: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    backgroundColor: colors.white,
    color: colors.text.primary,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  listView: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.primary,
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
});
