import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { Avatar } from '../../components/Avatar';
import { IOSButton } from '../../components/IOSButton';
import { colors, spacing, borderRadius } from '../../theme/theme';
import { platformShadow } from '../../lib/platformShadow';

export default function ProfileScreen() {
  const { userProfile, signOut } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const router = useRouter();

  const handleSignOut = async () => {
    Alert.alert(t('auth.logout'), 'Are you sure you want to log out?', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.logout'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/auth/login');
          } catch (error) {
            Alert.alert('Error', 'Failed to log out');
          }
        },
      },
    ]);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'no' : 'en');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Avatar uri={userProfile?.photoURL} size={100} />
        <Text style={styles.name}>{userProfile?.displayName || 'User'}</Text>
        <Text style={styles.email}>{userProfile?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {userProfile?.role === 'customer' ? '👤 Customer' : '🚚 Carrier'}
          </Text>
        </View>
        {userProfile?.verified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>✓ {t('profile.verified')}</Text>
          </View>
        )}
      </View>

      {userProfile?.rating !== undefined && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{userProfile.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.statLabel}>⭐ {t('profile.rating')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{userProfile.reviewCount || 0}</Text>
            <Text style={styles.statLabel}>{t('profile.reviews')}</Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/profile/edit')}>
          <Text style={styles.menuItemText}>{t('profile.editProfile')}</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={toggleLanguage}>
          <Text style={styles.menuItemText}>
            {t('profile.language')}: {language === 'en' ? 'English' : 'Norsk'}
          </Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        {userProfile?.role === 'carrier' && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/profile/carrier-verification')}
          >
            <Text style={styles.menuItemText}>Carrier Verification</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.settings')}</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Notifications</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Privacy & Security</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>Help & Support</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <IOSButton
        title={t('auth.logout')}
        onPress={handleSignOut}
        variant="outlined"
        style={styles.logoutButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    backgroundColor: colors.background,
    padding: spacing.xl,
    alignItems: 'center',
    ...platformShadow(2),
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.md,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  roleBadge: {
    backgroundColor: colors.primaryVeryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  roleText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '600',
  },
  verifiedBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
  verifiedText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...platformShadow(2),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.md,
  },
  section: {
    marginTop: spacing.lg,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.text,
  },
  menuItemArrow: {
    fontSize: 24,
    color: colors.textSecondary,
  },
  logoutButton: {
    margin: spacing.lg,
  },
});
