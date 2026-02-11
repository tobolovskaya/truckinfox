import { Platform, ViewStyle } from 'react-native';

/**
 * Creates platform-specific shadow styles
 * iOS uses shadow props, Android uses elevation
 */
export const platformShadow = (elevation: number): ViewStyle => {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: elevation / 2 },
      shadowOpacity: 0.1 + elevation * 0.02,
      shadowRadius: elevation,
    };
  }

  return {
    elevation,
  };
};

export default platformShadow;
