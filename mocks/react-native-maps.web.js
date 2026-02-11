import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapView = ({ children, style, ...props }) => {
  return (
    <View style={[styles.mapPlaceholder, style]}>
      <Text style={styles.text}>Map view is only available on mobile devices</Text>
      {children}
    </View>
  );
};

const Marker = () => null;
const Polyline = () => null;
const PROVIDER_GOOGLE = 'google';

const styles = StyleSheet.create({
  mapPlaceholder: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default MapView;
export { Marker, Polyline, PROVIDER_GOOGLE };
