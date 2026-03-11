import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { spacing, fontSize, fontWeight, useAppThemeStyles } from '../../lib/sharedStyles';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EmptyState } from '../../components/EmptyState';
import EmptyPaymentsIllustration from '../../assets/empty-payments.svg';
import { usePaymentHistory, PaymentRecord } from '../../hooks/usePaymentHistory';
import { triggerHapticFeedback } from '../../utils/haptics';

export default function PaymentsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useAppThemeStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<PaymentRecord['status'] | undefined>(
    undefined
  );

  const userId = user?.uid;

  const {
    payments,
    stats,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = usePaymentHistory({
    userId: userId || '',
    statusFilter: selectedStatus,
  });

  const displayedPayments = useMemo(() => {
    if (!payments) return [];
    return payments.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [payments]);

  const statusColors: Record<PaymentRecord['status'], string> = {
    completed: colors.success,
    pending: colors.status.warning,
    failed: colors.error,
    refunded: colors.info,
  };

  const statusLabels: Record<PaymentRecord['status'], string> = {
    completed: t('paymentCompleted') || 'Completed',
    pending: t('paymentPending') || 'Pending',
    failed: t('paymentFailed') || 'Failed',
    refunded: t('paymentRefunded') || 'Refunded',
  };

  const language = i18n?.language || 'en';
  const locale = language.startsWith('no') ? 'nb-NO' : 'en-US';

  const formatCurrency = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const renderPaymentCard = ({ item }: { item: PaymentRecord }) => (
    <View style={styles.paymentCard}>
      <View style={styles.paymentHeader}>
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentTitle}>
            {item.order_title || `${t('order')} ${item.order_id.slice(-6)}`}
          </Text>
          <Text style={styles.paymentDate}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={styles.amount}>{formatCurrency(item.amount, item.currency)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColors[item.status]}20` }]}>
            <Text style={[styles.statusText, { color: statusColors[item.status] }]}>
              {statusLabels[item.status]}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.paymentDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('paymentMethod') || 'Payment Method'}:</Text>
          <Text style={styles.detailValue}>{item.payment_method}</Text>
        </View>
        {item.reference_id && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('reference') || 'Reference ID'}:</Text>
            <Text style={styles.detailValue}>{item.reference_id}</Text>
          </View>
        )}
        {item.description && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('description') || 'Description'}:</Text>
            <Text style={styles.detailValue}>{item.description}</Text>
          </View>
        )}
      </View>

      {item.invoice_url && (
        <TouchableOpacity
          style={styles.invoiceButton}
          onPress={() => Alert.alert(t('viewInvoice') || 'View Invoice', 'Faktura kommer snart')}
        >
          <Ionicons name="document-outline" size={16} color={colors.primary} />
          <Text style={styles.invoiceButtonText}>{t('viewInvoice') || 'View Invoice'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFilterButton = (status: PaymentRecord['status']) => (
    <TouchableOpacity
      key={status}
      style={[styles.filterButton, selectedStatus === status && styles.filterButtonActive]}
      onPress={() => {
        triggerHapticFeedback.light();
        setSelectedStatus(selectedStatus === status ? undefined : status);
      }}
    >
      <Text
        style={[
          styles.filterButtonText,
          selectedStatus === status && styles.filterButtonTextActive,
        ]}
      >
        {statusLabels[status]}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading && !payments.length) {
    return (
      <View style={styles.container}>
        <ScreenHeader title={t('paymentHistory')} showBackButton={true} />
        <View style={styles.filterSection}>
          <View style={styles.filterButtons}>
            {[0, 1, 2, 3].map(index => (
              <View key={index} style={styles.filterChipPlaceholder} />
            ))}
          </View>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('paymentHistory')} showBackButton={true} />

      {/* Stats Section */}
      {stats.totalAmount > 0 && (
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('totalSpent') || 'Total Spent'}</Text>
            <Text style={styles.statValue}>{formatCurrency(stats.totalAmount, 'NOK').replace('NOK', '').replace('kr', '').trim() + ' kr'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>{t('transactions') || 'Transactions'}</Text>
            <Text style={styles.statValue}>{stats.completedCount}</Text>
          </View>
        </View>
      )}

      {/* Filter Buttons */}
      <View style={styles.filterSection}>
        <View style={styles.filterButtons}>
          {(['completed', 'pending', 'failed', 'refunded'] as const).map(status =>
            renderFilterButton(status)
          )}
        </View>
      </View>

      {/* Payment List */}
      {displayedPayments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="wallet-outline"
            title={t('noPayments') || 'No Payments'}
            description={
              selectedStatus
                ? t('noPaymentsWithFilter') || 'No payments with this status'
                : t('noPaymentsYet') || 'Start by placing an order'
            }
            illustration={EmptyPaymentsIllustration}
          />
        </View>
      ) : (
        <FlatList
          data={displayedPayments}
          renderItem={renderPaymentCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null
          }
        />
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>{t('retry') || 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppThemeStyles>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    statsSection: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.white,
      borderRadius: spacing.sm,
      padding: spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    statLabel: {
      fontSize: fontSize.xs,
      color: colors.text.secondary,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    statValue: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      color: colors.text.primary,
      marginTop: spacing.xs,
    },
    filterSection: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    filterButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    filterButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: spacing.lg,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border.default,
    },
    filterChipPlaceholder: {
      width: 96,
      height: 36,
      borderRadius: spacing.lg,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border.default,
      opacity: 0.7,
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterButtonText: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    filterButtonTextActive: {
      color: colors.white,
    },
    listContent: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    paymentCard: {
      backgroundColor: colors.white,
      borderRadius: spacing.md,
      padding: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      marginBottom: spacing.xs,
    },
    paymentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    paymentInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    paymentTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      color: colors.text.primary,
    },
    paymentDate: {
      fontSize: fontSize.xs,
      color: colors.text.secondary,
      marginTop: spacing.xs,
    },
    amountContainer: {
      alignItems: 'flex-end',
    },
    amount: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: colors.success,
    },
    statusBadge: {
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: spacing.sm,
    },
    statusText: {
      fontSize: fontSize.xs,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border.default,
      marginVertical: spacing.md,
    },
    paymentDetails: {
      gap: spacing.sm,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    detailLabel: {
      fontSize: fontSize.sm,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    detailValue: {
      fontSize: fontSize.sm,
      color: colors.text.primary,
      flex: 1,
      textAlign: 'right',
      marginLeft: spacing.md,
    },
    invoiceButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
      gap: spacing.xs,
    },
    invoiceButtonText: {
      fontSize: fontSize.sm,
      color: colors.primary,
      fontWeight: '600',
    },
    errorContainer: {
      backgroundColor: `${colors.error}10`,
      borderTopWidth: 1,
      borderTopColor: colors.error,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    errorText: {
      fontSize: fontSize.sm,
      color: colors.error,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.error,
      borderRadius: spacing.sm,
    },
    retryButtonText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
  });
