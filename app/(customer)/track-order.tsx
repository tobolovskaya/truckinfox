import { StyleSheet, Text, View } from 'react-native';

export default function TrackOrderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Track Order</Text>
      <Text>Live tracking details.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
});
