import { StyleSheet, Text, View } from 'react-native';

type BidListProps = {
  count: number;
};

export default function BidList({ count }: BidListProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Bids received: {count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: '#f8fafc', borderRadius: 10 },
  text: { fontSize: 14, color: '#111827' },
});
