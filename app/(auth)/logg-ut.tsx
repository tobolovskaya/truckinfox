import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../lib/sharedStyles';

export default function LoggUtScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, signOut, signOutAllDevices } = useAuth();
  const [loading, setLoading] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  useEffect(() => {
    // If user is not logged in, redirect to login
    if (!user) {
      router.replace('/(auth)/login');
    }
  }, [user, router]);

  const handleSignOut = async () => {
    try {
      setLoading(true);
      const result = await signOut();
      if (result.success) {
        router.replace('/(auth)/login');
      } else {
        Alert.alert(t('error'), result.error || t('somethingWentWrong'));
      }
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert(t('error'), t('somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutAll = async () => {
    Alert.alert(t('signOutAllDevices'), t('signOutAllConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: async () => {
          try {
            setSigningOutAll(true);
            const result = await signOutAllDevices();
            if (result.success) {
              router.replace('/(auth)/login');
            } else {
              Alert.alert(t('error'), result.error || t('somethingWentWrong'));
            }
          } catch (error) {
            console.error('Sign out all error:', error);
            Alert.alert(t('error'), t('somethingWentWrong'));
          } finally {
            setSigningOutAll(false);
          }
        },
      },
    ]);
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="log-out-outline" size={48} color={colors.primary} />
        </View>

        {/* Title and Message */}
        <Text style={styles.title}>{t('signOut')}</Text>
        <Text style={styles.message}>{t('confirmSignOut')}</Text>

        {/* User Info */}
        {user && (
          <View style={styles.userCard}>
            <View style={styles.avatarSmall}>
              <Ionicons name="person" size={24} color={colors.white} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.displayName || 'User'}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {/* Sign Out from This Device */}
          <TouchableOpacity
            style={[styles.signOutButton, loading && styles.buttonDisabled]}
            onPress={handleSignOut}
            disabled={loading || signingOutAll}
            accessibilityRole="button"
            accessibilityLabel={t('signOut')}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color={colors.white} />
                <Text style={styles.signOutButtonText}>{t('signOut')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sign Out from All Devices */}
          <TouchableOpacity
            style={[styles.signOutAllButton, signingOutAll && styles.buttonDisabled]}
            onPress={handleSignOutAll}
            disabled={loading || signingOutAll}
            accessibilityRole="button"
            accessibilityLabel={t('signOutAllDevices')}
          >
            {signingOutAll ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Ionicons name="exit-outline" size={20} color={colors.error} />
                <Text style={styles.signOutAllButtonText}>{t('signOutAllDevices')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={loading || signingOutAll}
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
          >
            <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>

        {/* Info Text */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={colors.info} />
          <Text style={styles.infoText}>{t('signOutInfo')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing.xl,
    width: '100%',
  },
  avatarSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xxxs,
  },
  userEmail: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  buttonContainer: {
    width: '100%',
    gap: spacing.md,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    height: 44,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
  },
  signOutButtonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  signOutAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    height: 44,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.error,
    gap: spacing.sm,
  },
  signOutAllButtonText: {
    color: colors.error,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    height: 44,
    borderRadius: borderRadius.sm,
  },
  cancelButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    lineHeight: 20,
  },
});
