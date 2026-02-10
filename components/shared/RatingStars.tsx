import { StyleSheet, Text, View } from 'react-native';

type RatingStarsProps = {
  rating: number;
};

export default function RatingStars({ rating }: RatingStarsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Rating: {rating.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 8, backgroundColor: '#fff7ed', borderRadius: 10 },
  text: { fontSize: 12, fontWeight: '600', color: '#9a3412' },
});
