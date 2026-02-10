import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TruckinFox</Text>
      <View style={styles.links}>
        <Link href="/(auth)/login" style={styles.link}>Go to login</Link>
        <Link href="/(customer)/create-order" style={styles.link}>Create order</Link>
        <Link href="/(carrier)/marketplace" style={styles.link}>Marketplace</Link>
        <Link href="/(shared)/profile" style={styles.link}>Profile</Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f6f8',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  links: {
    gap: 12,
    width: '100%',
  },
  link: {
    fontSize: 16,
    color: '#1f4cf0',
  },
});
