import { StyleSheet, Text, View } from 'react-native';

type PaymentModalProps = {
  amount: string;
};

export default function PaymentModal({ amount }: PaymentModalProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Summary</Text>
      <Text>Total: {amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', borderRadius: 12, gap: 8 },
  title: { fontSize: 16, fontWeight: '600' },
});
