import React, { useEffect, useState } from 'react';
import { View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AvatarProps {
  photoURL?: string | null;
  size?: number;
  iconName?: 'person' | 'person-circle-outline' | 'business';
  backgroundColor?: string;
  iconColor?: string;
}

export default function Avatar({
  photoURL,
  size = 40,
  iconName = 'person',
  backgroundColor = '#FFD9CC',
  iconColor = '#FF7043',
}: AvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [photoURL]);

  const shouldShowImage = Boolean(photoURL) && !hasImageError;

  return shouldShowImage ? (
    <Image
      source={{ uri: photoURL as string }}
      onError={() => setHasImageError(true)}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
      }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Ionicons name={iconName} size={size * 0.5} color={iconColor} />
    </View>
  );
}
