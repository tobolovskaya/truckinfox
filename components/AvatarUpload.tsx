import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from './Avatar';
import { colors, spacing } from '../theme';

interface AvatarUploadProps {
  currentUri?: string;
  onUpload: (uri: string) => Promise<void>;
  size?: number;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({ currentUri, onUpload, size = 100 }) => {
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant camera roll permissions to upload an avatar.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        await onUpload(result.assets[0].uri);
        setUploading(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={pickImage} disabled={uploading} style={styles.avatarButton}>
        <Avatar uri={currentUri} size={size} />
        {uploading && (
          <View
            style={[styles.loadingOverlay, { width: size, height: size, borderRadius: size / 2 }]}
          >
            <ActivityIndicator color={colors.background} size="large" />
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.changeText}>Tap to change</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  avatarButton: {
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeText: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontSize: 14,
  },
});

export default AvatarUpload;
