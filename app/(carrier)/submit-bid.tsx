import { StyleSheet, Text, View } from 'react-native';

export default function SubmitBidScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Submit Bid</Text>
      <Text>Place a bid for an order.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
});
