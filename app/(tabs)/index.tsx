import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { QuickActionCard } from '../../components/home/QuickActionCard';
import { colors, spacing } from '../../theme';

export default function HomeScreen() {
  const { userProfile } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const isCustomer = userProfile?.role === 'customer';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {t('common.welcome')}, {userProfile?.displayName || 'User'}!
        </Text>
        <Text style={styles.subGreeting}>
          {isCustomer ? 'Find reliable carriers for your cargo' : 'Find cargo opportunities'}
        </Text>
      </View>

      <View style={styles.quickActions}>
        {isCustomer ? (
          <>
            <QuickActionCard
              icon="📦"
              title="Create Request"
              subtitle="Post a new cargo"
              onPress={() => router.push('/edit-request/new')}
            />
            <QuickActionCard
              icon="📋"
              title="My Requests"
              subtitle="View your cargo"
              onPress={() => router.push('/marketplace')}
            />
          </>
        ) : (
          <>
            <QuickActionCard
              icon="🔍"
              title="Browse Cargo"
              subtitle="Find opportunities"
              onPress={() => router.push('/marketplace')}
            />
            <QuickActionCard
              icon="💼"
              title="My Bids"
              subtitle="View your bids"
              onPress={() => router.push('/marketplace')}
            />
          </>
        )}
      </View>

      <View style={styles.quickActions}>
        <QuickActionCard
          icon="🚚"
          title="Active Deliveries"
          subtitle="Track your orders"
          onPress={() => router.push('/marketplace')}
        />
        <QuickActionCard
          icon="⭐"
          title="Reviews"
          subtitle="Your ratings"
          onPress={() => router.push('/profile')}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.recentRequests')}</Text>
          <TouchableOpacity onPress={() => router.push('/marketplace')}>
            <Text style={styles.viewAll}>{t('home.viewAll')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No recent requests</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.background,
    marginBottom: spacing.xs,
  },
  subGreeting: {
    fontSize: 16,
    color: colors.background,
    opacity: 0.9,
  },
  quickActions: {
    flexDirection: 'row',
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  section: {
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  viewAll: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});
