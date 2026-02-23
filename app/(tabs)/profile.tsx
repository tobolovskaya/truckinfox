import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fontSize, fontWeight } from '../../lib/sharedStyles';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../../components/Avatar';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

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
      onPress: () => {},
    },
    {
      id: 'help',
      icon: 'help-circle-outline',
      label: t('helpSupport'),
      onPress: () => {},
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.headerTitle}>{t('profile')}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Avatar
            photoURL={user?.photoURL}
            size={80}
            backgroundColor={`${colors.primary}15`}
            iconColor={colors.primary}
          />
          <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
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
        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
  },
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
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
});
