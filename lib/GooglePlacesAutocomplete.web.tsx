// Web platform: mock GooglePlacesAutocomplete
import React from 'react';
import { TextInput, View, StyleSheet, Text } from 'react-native';
import type { GooglePlacesAutocompleteProps } from './GooglePlacesAutocomplete';

// Mock GooglePlacesAutocomplete for web
export const GooglePlacesAutocomplete = ({
  placeholder,
  onPress,
  query: _query,
  styles: customStyles,
  textInputProps,
}: GooglePlacesAutocompleteProps) => {
  const [value, setValue] = React.useState('');

  return (
    <View style={[localStyles.container, customStyles?.container]}>
      <TextInput
        style={[localStyles.input, customStyles?.textInput]}
        placeholder={placeholder || 'Enter address'}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={() => {
          if (onPress && value) {
            onPress(
              { description: value },
              { geometry: { location: { lat: 59.9139, lng: 10.7522 } } } // Oslo default
            );
          }
        }}
        {...textInputProps}
      />
      <Text style={localStyles.note}>
        Google Places Autocomplete is only available on mobile. Enter address manually.
      </Text>
    </View>
  );
};

const localStyles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
  },
  note: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
