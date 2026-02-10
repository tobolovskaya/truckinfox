import { StyleSheet, Text, View } from 'react-native';

export default function VerificationBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>Verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { backgroundColor: '#e6fffa', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  text: { fontSize: 12, fontWeight: '600', color: '#0f766e' },
});
