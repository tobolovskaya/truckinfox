import { ComponentType } from 'react';
import { ViewProps, TextInputProps, StyleProp, ViewStyle, TextStyle } from 'react-native';

export interface GooglePlacesLocation {
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
}

export interface GooglePlacesGeometry {
  location?: GooglePlacesLocation;
}

export interface GooglePlacesData {
  description: string;
  place_id?: string;
}

export interface GooglePlacesDetails {
  geometry?: GooglePlacesGeometry;
}

export interface GooglePlacesAutocompleteStyles {
  container?: StyleProp<ViewStyle>;
  textInputContainer?: StyleProp<ViewStyle>;
  textInput?: StyleProp<TextStyle>;
  listView?: StyleProp<ViewStyle>;
  row?: StyleProp<ViewStyle>;
  separator?: StyleProp<ViewStyle>;
  description?: StyleProp<TextStyle>;
}

export interface GooglePlacesAutocompleteProps extends ViewProps, TextInputProps {
  placeholder?: string;
  onPress?: (data: GooglePlacesData, details?: GooglePlacesDetails | null) => void;
  query?: Record<string, unknown>;
  styles?: GooglePlacesAutocompleteStyles;
  textInputProps?: TextInputProps;
  fetchDetails?: boolean;
  enablePoweredByContainer?: boolean;
  debounce?: number;
  minLength?: number;
  nearbyPlacesAPI?: string;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled' | boolean;
  listViewDisplayed?: 'auto' | 'true' | 'false' | boolean;
  predefinedPlaces?: Array<{
    description: string;
    geometry?: GooglePlacesGeometry;
  }>;
}

declare const GooglePlacesAutocomplete: ComponentType<GooglePlacesAutocompleteProps>;

export { GooglePlacesAutocomplete };
