import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FirebaseError } from 'firebase/app';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { storage, db } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme/theme';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../lib/sharedStyles';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface AvatarUploadProps {
  avatarUrl?: string;
  onUpload: (_url: string) => void;
  size?: number;
}

export default function AvatarUpload({ avatarUrl, onUpload, size = 80 }: AvatarUploadProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  const compressImage = async (uri: string) => {
    const manipResult = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return manipResult.uri;
  };

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('error'), t('cameraRollPermissionRequired'));
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const compressedUri = await compressImage(result.assets[0].uri);
        uploadAvatar(compressedUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('error'), t('failedToPickImage'));
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user?.uid) return;

    setUploading(true);
    try {
      // Create file name
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `avatars/${user.uid}/avatar.${fileExt}`;

      // Convert URI to blob for Firebase Storage with timeout
      const response = await fetchWithTimeout(
        uri,
        {
          method: 'GET',
        },
        15000
      ); // 15 second timeout for image download
      const blob = await response.blob();

      // Upload to Firebase Storage
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, blob, {
        contentType: `image/${fileExt}`,
      });

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update user profile in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        avatar_url: downloadURL,
        updated_at: new Date().toISOString(),
      });

      // Update Firebase Auth profile
      await updateProfile(user, {
        photoURL: downloadURL,
      });

      onUpload(downloadURL);
      Alert.alert(t('success'), t('avatarUpdatedSuccessfully'));
    } catch (error) {
      console.error('Error uploading avatar:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload avatar';
      Alert.alert(t('error'), message);
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!user?.uid || !avatarUrl) return;

    Alert.alert(t('removeAvatar'), t('confirmRemoveAvatar'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            setUploading(true);

            // Remove from Firebase Storage
            const fileExt = avatarUrl.split('.').pop()?.split('?')[0] || 'jpg';
            const fileName = `avatars/${user.uid}/avatar.${fileExt}`;
            const storageRef = ref(storage, fileName);

            try {
              await deleteObject(storageRef);
            } catch (error) {
              const firebaseError = error as FirebaseError;
              const ignoredCodes = ['storage/object-not-found', 'storage/unauthorized'];
              if (!ignoredCodes.includes(firebaseError.code)) {
                console.warn('Avatar delete warning:', error);
              }
            }

            // Update user profile in Firestore
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
              avatar_url: null,
              updated_at: new Date().toISOString(),
            });

            // Update Firebase Auth profile
            await updateProfile(user, {
              photoURL: null,
            });

            onUpload('');
            Alert.alert(t('success'), t('avatarRemovedSuccessfully'));
          } catch (error) {
            console.error('Error removing avatar:', error);
            const message = error instanceof Error ? error.message : 'Failed to remove avatar';
            Alert.alert(t('error'), message);
          } finally {
            setUploading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.avatarContainer, { width: size, height: size }]}
        onPress={pickImage}
        disabled={uploading}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={[styles.avatar, { width: size, height: size }]}
          />
        ) : (
          <View style={[styles.placeholder, { width: size, height: size }]}>
            <Ionicons name="person" size={size * 0.5} color={theme.iconColors.gray.primary} />
          </View>
        )}

        {uploading && (
          <View style={[styles.uploadingOverlay, { width: size, height: size }]}>
            <ActivityIndicator size="small" color={theme.iconColors.white} />
          </View>
        )}

        <View style={styles.editBadge}>
          <Ionicons name="camera" size={16} color={theme.iconColors.white} />
        </View>
      </TouchableOpacity>

      {avatarUrl && (
        <TouchableOpacity style={styles.removeButton} onPress={removeAvatar} disabled={uploading}>
          <Ionicons name="trash-outline" size={16} color={theme.iconColors.error} />
          <Text style={styles.removeText}>{t('remove')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatar: {
    borderRadius: borderRadius.full,
  },
  placeholder: {
    backgroundColor: colors.badge.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxxs,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  removeText: {
    fontSize: fontSize.xs,
    color: colors.status.error,
    marginLeft: spacing.xs,
    fontWeight: fontWeight.semibold,
  },
});
