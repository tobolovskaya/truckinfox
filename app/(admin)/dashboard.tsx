import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { borderRadius, colors, fontSize, fontWeight, spacing } from '../../lib/sharedStyles';

type AdminStats = {
  totalRequests: number;
  totalBids: number;
  conversionRate: number;
};

type StatCardProps = {
  title: string;
  value: string | number;
};

function StatCard({ title, value }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function AdminDashboard() {
  const {
    data: stats,
    isLoading,
    isError,
    error,
  } = useQuery<AdminStats, Error>({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [requestsSnap, bidsSnap] = await Promise.all([
        getDocs(collection(db, 'cargo_requests')),
        getDocs(collection(db, 'bids')),
      ]);

      const totalRequests = requestsSnap.size;
      const totalBids = bidsSnap.size;
      const conversionRate = totalRequests > 0 ? totalBids / totalRequests : 0;

      return {
        totalRequests,
        totalBids,
        conversionRate,
      };
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !stats) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorTitle}>Failed to load dashboard</Text>
        <Text style={styles.errorText}>{error?.message ?? 'Unknown error'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <StatCard title="Requests" value={stats.totalRequests} />
      <StatCard title="Bids" value={stats.totalBids} />
      <StatCard title="Conversion" value={`${(stats.conversionRate * 100).toFixed(1)}%`} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.md,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  statTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  errorTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.error,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
