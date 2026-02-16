// Base MapView module - platform-specific implementations in .native.ts and .web.ts
// This file provides TypeScript type information for the platform-specific modules

import { ComponentType } from 'react';
import { ViewProps } from 'react-native';

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface MapViewProps extends ViewProps {
  initialRegion?: Region;
  region?: Region;
  onRegionChange?: (region: Region) => void;
  showsUserLocation?: boolean;
  children?: React.ReactNode;
}

export interface MarkerProps extends ViewProps {
  coordinate: LatLng;
  title?: string;
  description?: string;
}

export interface PolylineProps extends ViewProps {
  coordinates: LatLng[];
  strokeWidth?: number;
  strokeColor?: string;
}

declare const MapView: ComponentType<MapViewProps>;
declare const Marker: ComponentType<MarkerProps>;
declare const Polyline: ComponentType<PolylineProps>;
declare const PROVIDER_GOOGLE: string;

export { MapView as default, Marker, Polyline, PROVIDER_GOOGLE };
