import { StyleSheet, Text, View } from 'react-native';

export default function BrowseBidsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Browse Bids</Text>
      <Text>Review carrier bids.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
});
