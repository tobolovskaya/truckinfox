import { StyleSheet, Text, View } from 'react-native';

export default function CreateOrderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Order</Text>
      <Text>Start a new shipment request.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
});
