import { StyleSheet, Text, View } from 'react-native';

export default function ProfileSelectionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Selection</Text>
      <Text>Choose customer or carrier.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
});
