import { StyleSheet, Text, View } from 'react-native';

type CargoCardProps = {
  route: string;
  price: string;
};

export default function CargoCard({ route, price }: CargoCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.route}>{route}</Text>
      <Text style={styles.price}>{price}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 6 },
  route: { fontSize: 16, fontWeight: '600' },
  price: { fontSize: 14, color: '#1f4cf0' },
});
