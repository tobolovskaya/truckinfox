import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';

const DEFAULT_MAX_WIDTH = 1200;
const DEFAULT_TARGET_SIZE_BYTES = 1_500_000;
const DEFAULT_INITIAL_QUALITY = 0.72;
const DEFAULT_MIN_QUALITY = 0.45;

const getImageDimensions = async (uri: string): Promise<{ width: number; height: number } | null> => {
  try {
    return await new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        error => reject(error)
      );
    });
  } catch {
    return null;
  }
};

const getFileSizeBytes = async (uri: string): Promise<number | null> => {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && typeof info.size === 'number' ? info.size : null;
  } catch {
    return null;
  }
};

export const compressImageForUpload = async (uri: string): Promise<string> => {
  try {
    const dimensions = await getImageDimensions(uri);
    const originalSize = await getFileSizeBytes(uri);

    const needsResize =
      dimensions !== null && Math.max(dimensions.width, dimensions.height) > DEFAULT_MAX_WIDTH;
    const needsCompression = originalSize === null || originalSize > DEFAULT_TARGET_SIZE_BYTES;

    if (!needsResize && !needsCompression) {
      return uri;
    }

    const resizeActions =
      dimensions !== null && needsResize
        ? dimensions.width >= dimensions.height
          ? [{ resize: { width: DEFAULT_MAX_WIDTH } }]
          : [{ resize: { height: DEFAULT_MAX_WIDTH } }]
        : [];

    let quality = DEFAULT_INITIAL_QUALITY;
    let result = await manipulateAsync(uri, resizeActions, {
      compress: quality,
      format: SaveFormat.JPEG,
    });

    let compressedSize = await getFileSizeBytes(result.uri);
    while (
      compressedSize !== null &&
      compressedSize > DEFAULT_TARGET_SIZE_BYTES &&
      quality > DEFAULT_MIN_QUALITY
    ) {
      quality = Math.max(DEFAULT_MIN_QUALITY, quality - 0.1);
      result = await manipulateAsync(result.uri, [], {
        compress: quality,
        format: SaveFormat.JPEG,
      });
      compressedSize = await getFileSizeBytes(result.uri);
    }

    return result.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    return uri;
  }
};
