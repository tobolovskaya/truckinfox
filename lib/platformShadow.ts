import { Platform } from 'react-native';

interface ShadowParams {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation?: number;
}

export function getPlatformShadow(params: ShadowParams) {
  const { shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation } = params;

  if (Platform.OS === 'web') {
    const rgbaColor =
      shadowColor === '#000' || shadowColor === 'black'
        ? `rgba(0, 0, 0, ${shadowOpacity})`
        : shadowColor.includes('rgb')
          ? shadowColor
          : shadowColor;

    return {
      boxShadow: `${shadowOffset.width}px ${shadowOffset.height}px ${shadowRadius}px ${rgbaColor}`,
    };
  }

  return {
    shadowColor,
    shadowOffset,
    shadowOpacity,
    shadowRadius,
    ...(elevation !== undefined && Platform.OS === 'android' ? { elevation } : {}),
  };
}
