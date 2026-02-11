import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors } from '../theme';

export const NetworkStatusBar: React.FC = () => {
  const { isConnected } = useNetworkStatus();

  if (isConnected === null || isConnected) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.error,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default NetworkStatusBar;
