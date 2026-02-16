// Web platform: mock SuperCluster (not supported on web)
import React from 'react';
import { View } from 'react-native';

// Mock SuperCluster that just renders its children for web
const SuperCluster = ({ children, ...props }: any) => {
  return <View {...props}>{children}</View>;
};

export default SuperCluster;
