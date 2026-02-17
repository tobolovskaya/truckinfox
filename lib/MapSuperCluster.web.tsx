// Web platform: mock SuperCluster (not supported on web)
import React, { type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

type SuperClusterProps = ViewProps & {
  children?: ReactNode;
};

const SuperCluster = ({ children, ...props }: SuperClusterProps) => {
  return <View {...props}>{children}</View>;
};

export default SuperCluster;
