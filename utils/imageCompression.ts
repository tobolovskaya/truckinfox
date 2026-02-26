import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const DEFAULT_MAX_WIDTH = 1200;
const DEFAULT_QUALITY = 0.7;

export const compressImageForUpload = async (uri: string): Promise<string> => {
  try {
    const result = await manipulateAsync(uri, [{ resize: { width: DEFAULT_MAX_WIDTH } }], {
      compress: DEFAULT_QUALITY,
      format: SaveFormat.JPEG,
    });
    return result.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    return uri;
  }
};
