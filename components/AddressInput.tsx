import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import * as Location from 'expo-location';
import { colors, spacing, borderRadius } from '../theme';
import { IOSButton } from './IOSButton';

interface AddressInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onLocationSelected?: (location: { latitude: number; longitude: number; address: string }) => void;
  placeholder?: string;
  label?: string;
}

export const AddressInput: React.FC<AddressInputProps> = ({
  value,
  onChangeText,
  onLocationSelected,
  placeholder = 'Enter address',
  label,
}) => {
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant location permissions to use this feature.');
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = currentLocation.coords;

      // Reverse geocode to get address
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (addresses && addresses.length > 0) {
        const address = addresses[0];
        const formattedAddress = [
          address.street,
          address.city,
          address.postalCode,
          address.country,
        ]
          .filter(Boolean)
          .join(', ');

        onChangeText(formattedAddress);
        
        if (onLocationSelected) {
          onLocationSelected({
            latitude,
            longitude,
            address: formattedAddress,
          });
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Failed to get current location. Please try again.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDisabled}
        />
        <TouchableOpacity
          onPress={getCurrentLocation}
          disabled={loading}
          style={styles.locationButton}
        >
          <Text style={styles.locationButtonText}>
            {loading ? '...' : '📍'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  locationButton: {
    padding: spacing.md,
  },
  locationButtonText: {
    fontSize: 24,
  },
});

export default AddressInput;
