import { StyleSheet, View } from 'react-native';
import MapView from 'react-native-maps';

export default function MapViewCard() {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 59.9139,
          longitude: 10.7522,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 220, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1 },
});
