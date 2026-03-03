import React, { useEffect, useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme/theme';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '../lib/sharedStyles';
import { compressImageForUpload } from '../utils/imageCompression';

interface AvatarUploadProps {
  avatarUrl?: string;
  onUpload: (_url: string) => void;
  size?: number;
}

const STORAGE_SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 365;

export default function AvatarUpload({ avatarUrl, onUpload, size = 80 }: AvatarUploadProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState<string | undefined>(avatarUrl);
  const [signedFallbackAttempted, setSignedFallbackAttempted] = useState(false);
  const avatarBuckets = ['avatars', 'cargo'] as const;

  useEffect(() => {
    setImageLoadError(false);
    setSignedFallbackAttempted(false);
    setDisplayAvatarUrl(avatarUrl);
  }, [avatarUrl]);

  const extractStoragePath = (url?: string): string | null => {
    if (!url) {
      return null;
    }

    const cleanUrl = url.split('?')[0];
    const patterns = [
      '/object/public/avatars/',
      '/object/public/cargo/',
      '/object/sign/avatars/',
      '/object/sign/cargo/',
      '/object/authenticated/avatars/',
      '/object/authenticated/cargo/',
    ];

    for (const pattern of patterns) {
      if (cleanUrl.includes(pattern)) {
        const extracted = cleanUrl.split(pattern)[1];
        if (extracted) {
          return extracted;
        }
      }
    }

    if (!cleanUrl.startsWith('http')) {
      return cleanUrl;
    }

    return null;
  };

  const resolveSignedAvatarUrl = async (url?: string): Promise<string | null> => {
    const storagePath = extractStoragePath(url);
    if (!storagePath) {
      return null;
    }

    for (const bucket of avatarBuckets) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60 * 60);
      if (!error && data?.signedUrl) {
        return `${data.signedUrl}${data.signedUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
      }
    }

    return null;
  };

  const base64ToUint8Array = (base64: string): Uint8Array => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const normalized = base64.replace(/=+$/, '');

    let buffer = 0;
    let bitsCollected = 0;
    const output: number[] = [];

    for (let index = 0; index < normalized.length; index += 1) {
      const char = normalized[index];
      const value = alphabet.indexOf(char);

      if (value < 0) {
        continue;
      }

      buffer = (buffer << 6) | value;
      bitsCollected += 6;

      if (bitsCollected >= 8) {
        bitsCollected -= 8;
        output.push((buffer >> bitsCollected) & 0xff);
      }
    }

    return new Uint8Array(output);
  };

  const compressImage = async (uri: string) => compressImageForUpload(uri);

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
        mediaTypes: ['images'],
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
      const fileName = `${user.uid}/avatar.jpg`;

      // Read local file bytes directly to avoid 0-byte uploads on mobile URI fetch.
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      const fileBytes = base64ToUint8Array(base64);

      if (!fileBytes || fileBytes.byteLength === 0) {
        throw new Error('Avatar file is empty. Please select another image.');
      }

      let selectedBucket: (typeof avatarBuckets)[number] | null = null;
      let lastUploadError: unknown = null;

      for (const bucket of avatarBuckets) {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, fileBytes, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!uploadError) {
          selectedBucket = bucket;
          break;
        }

        lastUploadError = uploadError;
        const uploadMessage =
          typeof uploadError.message === 'string' ? uploadError.message.toLowerCase() : '';
        if (!uploadMessage.includes('bucket not found')) {
          throw uploadError;
        }
      }

      if (!selectedBucket) {
        throw lastUploadError || new Error('No available storage bucket for avatar upload');
      }

      const { data: signedData, error: signedUrlError } = await supabase.storage
        .from(selectedBucket)
        .createSignedUrl(fileName, STORAGE_SIGNED_URL_EXPIRY_SECONDS);

      if (signedUrlError || !signedData?.signedUrl) {
        throw signedUrlError || new Error('Failed to create signed URL for avatar');
      }

      const cacheBustedUrl = `${signedData.signedUrl}${signedData.signedUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          avatar_url: cacheBustedUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.uid);

      if (profileError) {
        throw profileError;
      }

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: cacheBustedUrl,
        },
      });

      if (authUpdateError) {
        throw authUpdateError;
      }

      setImageLoadError(false);
      setDisplayAvatarUrl(cacheBustedUrl);
      onUpload(cacheBustedUrl);
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

            const storagePath = extractStoragePath(avatarUrl) || `${user.uid}/avatar.jpg`;

            try {
              if (storagePath) {
                await Promise.all(
                  avatarBuckets.map(bucket => supabase.storage.from(bucket).remove([storagePath]))
                );
              }
            } catch (error) {
              console.warn('Avatar delete warning:', error);
            }

            const { error: profileError } = await supabase
              .from('profiles')
              .update({
                avatar_url: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', user.uid);

            if (profileError) {
              throw profileError;
            }

            const { error: authUpdateError } = await supabase.auth.updateUser({
              data: {
                avatar_url: null,
              },
            });

            if (authUpdateError) {
              throw authUpdateError;
            }

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
        {displayAvatarUrl ? (
          <Image
            source={{ uri: displayAvatarUrl }}
            onError={async () => {
              if (!signedFallbackAttempted) {
                setSignedFallbackAttempted(true);
                const signedUrl = await resolveSignedAvatarUrl(displayAvatarUrl || avatarUrl);
                if (signedUrl) {
                  setImageLoadError(false);
                  setDisplayAvatarUrl(signedUrl);
                  return;
                }
              }
              setImageLoadError(true);
            }}
            style={[styles.avatar, { width: size, height: size }]}
          />
        ) : (
          <View style={[styles.placeholder, { width: size, height: size }]}>
            <Ionicons name="person" size={size * 0.5} color={theme.iconColors.gray.primary} />
          </View>
        )}

        {displayAvatarUrl && imageLoadError && (
          <View
            style={[
              styles.placeholder,
              { width: size, height: size, position: 'absolute', top: 0, left: 0 },
            ]}
          >
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

      {displayAvatarUrl && (
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
