import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../../lib/sharedStyles';

export default function SignInScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Sign In Screen - Coming Soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  text: {
    fontSize: fontSize.lg,
    color: colors.text.secondary,
  },
});
