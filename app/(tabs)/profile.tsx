import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import Avatar from '../../components/Avatar';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SkeletonLoader } from '../../components/SkeletonLoader';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { currentUser, loading } = useCurrentUser(user?.uid);
  const { t } = useTranslation();
  const isCarrier = currentUser?.user_type === 'carrier';

  const handleSignOut = async () => {
    Alert.alert(t('signOut'), t('confirmSignOut'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/(auth)/login');
          } catch (error) {
            console.error('Sign out error:', error);
          }
        },
      },
    ]);
  };

  const menuItems: Array<{
    id: string;
    icon: IoniconName;
    label: string;
    onPress: () => void;
  }> = [
    {
      id: 'edit',
      icon: 'person-outline',
      label: t('editProfile'),
      onPress: () => router.push('/profile/edit'),
    },
    ...(isCarrier
      ? [
          {
            id: 'trucks',
            icon: 'car-outline' as IoniconName,
            label: t('myTrucks'),
            onPress: () => router.push('/trucks'),
          },
        ]
      : []),
    {
      id: 'security',
      icon: 'shield-checkmark-outline',
      label: t('security'),
      onPress: () => router.push('/profile/security'),
    },
    {
      id: 'payments',
      icon: 'wallet-outline',
      label: t('paymentHistory'),
      onPress: () => router.push('/profile/payments'),
    },
    {
      id: 'settings',
      icon: 'settings-outline',
      label: t('settings'),
      onPress: () => router.push('/profile/settings'),
    },
    {
      id: 'help',
      icon: 'help-circle-outline',
      label: t('helpSupport'),
      onPress: () => router.push('/profile/help'),
    },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title={t('profile')}
          showBackButton={false}
          showBrandMark
          brandMarkMaxTitleLength={16}
        />
        <View style={styles.skeletonContainer}>
          <SkeletonLoader variant="stats" count={1} />
          <SkeletonLoader variant="list" count={5} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('profile')}
        showBackButton={false}
        showBrandMark
        brandMarkMaxTitleLength={16}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Avatar
            photoURL={user?.photoURL}
            size={80}
            backgroundColor={`${colors.primary}15`}
            iconColor={colors.primary}
          />
          <Text style={styles.userName}>{user?.displayName || t('customer')}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>

          {/* Carrier verification status */}
          {isCarrier && (
            currentUser?.is_verified ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.verifiedBadgeText}>
                  {currentUser.company_name
                    ? `${t('verifiedCarrier')} · ${currentUser.company_name}`
                    : t('verifiedCarrier')}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.verifyBanner}
                onPress={() => router.push('/profile/settings')}
                accessibilityRole="button"
              >
                <Ionicons name="shield-outline" size={16} color="#D97706" />
                <Text style={styles.verifyBannerText}>{t('verifyBusiness')}</Text>
                <Ionicons name="chevron-forward" size={14} color="#D97706" />
              </TouchableOpacity>
            )
          )}
        </View>

        {/* Menu Items */}
        <View style={styles.section}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, index === menuItems.length - 1 && styles.menuItemLast]}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Ionicons name={item.icon} size={24} color={colors.text.secondary} />
              <Text style={styles.menuItemText}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel={t('signOut')}
          accessibilityHint="Double tap to log out of your account"
        >
          <Ionicons name="log-out-outline" size={24} color="#F44336" />
          <Text style={styles.signOutButtonText}>{t('signOut')}</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>{`${t('version')} 1.0.0`}</Text>
      </ScrollView>
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
  },
  skeletonContainer: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  profileCard: {
    backgroundColor: colors.white,
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xxxs,
  },
  userEmail: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  section: {
    backgroundColor: colors.white,
    marginBottom: spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  signOutButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#F44336',
    marginLeft: spacing.sm,
  },
  version: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    paddingBottom: spacing.xl,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  verifiedBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#065F46',
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  verifyBannerText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#D97706',
  },
});
