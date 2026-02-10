import { StyleSheet, Text, View } from 'react-native';

type OrderCardProps = {
  title: string;
  status: string;
};

export default function OrderCard({ title, status }: OrderCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  title: { fontSize: 16, fontWeight: '600' },
  status: { fontSize: 12, color: '#6b7280' },
});
