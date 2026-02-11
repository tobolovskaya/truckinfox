import React from 'react';
import { RefreshControl as RNRefreshControl } from 'react-native';
import { colors } from '../theme/theme';

interface IOSRefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
}

export const IOSRefreshControl: React.FC<IOSRefreshControlProps> = ({ refreshing, onRefresh }) => {
  return (
    <RNRefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
    />
  );
};

export default IOSRefreshControl;
