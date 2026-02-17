// Web platform: export mock MapView
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../mocks/react-native-maps.web';

export { MapView as default, Marker, Polyline, PROVIDER_GOOGLE };

// Type definitions for web
export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type MapViewProps = Record<string, unknown>;
