import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize } from '../../lib/sharedStyles';

export default function EditProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Edit Profile Screen - Coming Soon</Text>
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
