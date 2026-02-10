import { StyleSheet, Text, View } from 'react-native';

type BidFormProps = {
  placeholderText?: string;
};

export default function BidForm({ placeholderText }: BidFormProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{placeholderText ?? 'Enter your bid'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 12, backgroundColor: '#f1f5f9' },
  text: { color: '#111827' },
});
