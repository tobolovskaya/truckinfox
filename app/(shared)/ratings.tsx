import { StyleSheet, Text, View } from 'react-native';

export default function RatingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ratings</Text>
      <Text>Review feedback and scores.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
});
