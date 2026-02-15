import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, getDocs, getDoc, doc } from 'firebase/firestore';
import { theme } from '../../theme/theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenSection } from '../../components/ScreenSection';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  shadows,
} from '../../lib/sharedStyles';

interface Payment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: 'initiated' | 'completed' | 'failed' | 'refunded' | 'released';
  payment_method: string;
  vipps_order_id?: string;
  created_at: any;
  updated_at?: any;
  customer_id: string;
  carrier_id: string;
  order?: {
    title: string;
    from_address: string;
    to_address: string;
  };
}

type FilterStatus = 'all' | 'initiated' | 'completed' | 'failed' | 'refunded' | 'released';

export default function PaymentHistoryScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');

  useEffect(() => {
    fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, payments]);

  const fetchPayments = async () => {
    try {
      if (!user?.uid) return;

      // Query payments where user is either customer or carrier
      const paymentsRef = collection(db, 'escrow_payments');
      const customerQuery = query(
        paymentsRef,
        where('customer_id', '==', user.uid),
        orderBy('created_at', 'desc')
      );
      const carrierQuery = query(
        paymentsRef,
        where('carrier_id', '==', user.uid),
        orderBy('created_at', 'desc')
      );

      const [customerSnap, carrierSnap] = await Promise.all([
        getDocs(customerQuery),
        getDocs(carrierQuery),
      ]);

      const allPayments: Payment[] = [];

      // Process customer payments
      for (const docSnap of customerSnap.docs) {
        const paymentData = { id: docSnap.id, ...docSnap.data() } as Payment;

        // Fetch associated order details
        if (paymentData.order_id) {
          const orderRef = doc(db, 'orders', paymentData.order_id);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            const orderData = orderSnap.data();
            if (orderData.request_id) {
              const requestRef = doc(db, 'cargo_requests', orderData.request_id);
              const requestSnap = await getDoc(requestRef);
              if (requestSnap.exists()) {
                paymentData.order = {
                  title: requestSnap.data().title || 'Cargo Transport',
                  from_address: requestSnap.data().from_address || '',
                  to_address: requestSnap.data().to_address || '',
                };
              }
            }
          }
        }

        allPayments.push(paymentData);
      }

      // Process carrier payments (if not already added)
      for (const docSnap of carrierSnap.docs) {
        if (!allPayments.find(p => p.id === docSnap.id)) {
          const paymentData = { id: docSnap.id, ...docSnap.data() } as Payment;

          // Fetch associated order details
          if (paymentData.order_id) {
            const orderRef = doc(db, 'orders', paymentData.order_id);
            const orderSnap = await getDoc(orderRef);
            if (orderSnap.exists()) {
              const orderData = orderSnap.data();
              if (orderData.request_id) {
                const requestRef = doc(db, 'cargo_requests', orderData.request_id);
                const requestSnap = await getDoc(requestRef);
                if (requestSnap.exists()) {
                  paymentData.order = {
                    title: requestSnap.data().title || 'Cargo Transport',
                    from_address: requestSnap.data().from_address || '',
                    to_address: requestSnap.data().to_address || '',
                  };
                }
              }
            }
          }

          allPayments.push(paymentData);
        }
      }

      // Sort by date
      allPayments.sort((a, b) => {
        const dateA = a.created_at?.toMillis?.() || 0;
        const dateB = b.created_at?.toMillis?.() || 0;
        return dateB - dateA;
      });

      setPayments(allPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      Alert.alert(t('error'), 'Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    if (filterStatus === 'all') {
      setFilteredPayments(payments);
    } else {
      setFilteredPayments(payments.filter(p => p.status === filterStatus));
    }
  };

  const getStatusColor = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
      case 'released':
        return theme.iconColors.success;
      case 'initiated':
        return theme.iconColors.info;
      case 'failed':
        return theme.iconColors.error;
      case 'refunded':
        return theme.iconColors.warning;
      default:
        return theme.iconColors.gray.primary;
    }
  };

  const getStatusIcon = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
      case 'released':
        return 'checkmark-circle';
      case 'initiated':
        return 'time';
      case 'failed':
        return 'close-circle';
      case 'refunded':
        return 'arrow-back-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate?.() || new Date(timestamp);
    return date.toLocaleDateString('no-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const generateTextReport = () => {
    let report = `${t('paymentHistory')}\n`;
    report += `Generated: ${new Date().toLocaleDateString()}\n\n`;
    report += `Total Payments: ${filteredPayments.length}\n`;
    report += `Filter: ${filterStatus === 'all' ? 'All' : t(filterStatus)}\n\n`;
    report += '='.repeat(50) + '\n\n';

    filteredPayments.forEach((payment, index) => {
      report += `Payment #${index + 1}\n`;
      report += `${t('paymentId')}: ${payment.id}\n`;
      report += `${t('transactionDate')}: ${formatDate(payment.created_at)}\n`;
      report += `${t('paymentStatus')}: ${t(payment.status)}\n`;
      report += `${t('escrowAmount')}: ${payment.amount} ${payment.currency}\n`;
      report += `${t('paymentMethod')}: ${payment.payment_method}\n`;
      if (payment.order) {
        report += `${t('orderDetails')}:\n`;
        report += `  - ${payment.order.title}\n`;
        report += `  - ${t('from')}: ${payment.order.from_address}\n`;
        report += `  - ${t('to')}: ${payment.order.to_address}\n`;
      }
      report += '\n' + '-'.repeat(50) + '\n\n';
    });

    return report;
  };

  const handleExportPDF = async () => {
    try {
      const report = generateTextReport();

      // Use Share API to share the report
      // Note: For actual PDF generation, you would need react-native-html-to-pdf
      // or a similar library. This is a text-based fallback.
      await Share.share({
        message: report,
        title: `${t('paymentHistory')} - TruckinFox`,
      });

      Alert.alert(t('exportSuccess'), 'Payment report shared successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert(t('exportError'), 'Failed to export payment report');
    }
  };

  const handleEmailReport = () => {
    setEmailModalVisible(true);
  };

  const sendEmailReport = async () => {
    try {
      if (!emailAddress || !emailAddress.includes('@')) {
        Alert.alert(t('error'), 'Please enter a valid email address');
        return;
      }

      const report = generateTextReport();

      // In production, this would call a Cloud Function to send the email
      // For now, we'll use the Share API
      await Share.share({
        message: report,
        title: `${t('paymentHistory')} - TruckinFox`,
      });

      setEmailModalVisible(false);
      setEmailAddress('');
      Alert.alert(t('emailSent'), `Report shared. Email to: ${emailAddress}`);
    } catch (error) {
      console.error('Error sending email:', error);
      Alert.alert(t('emailError'), 'Failed to send email report');
    }
  };

  const renderFilterButton = (status: FilterStatus, label: string) => (
    <TouchableOpacity
      style={[styles.filterButton, filterStatus === status && styles.filterButtonActive]}
      onPress={() => setFilterStatus(status)}
    >
      <Text
        style={[styles.filterButtonText, filterStatus === status && styles.filterButtonTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScreenHeader title={t('paymentHistory')} showBackButton />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.iconColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title={t('paymentHistory')} showBackButton />

      {/* Filter Buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {renderFilterButton('all', 'All')}
        {renderFilterButton('completed', t('completed'))}
        {renderFilterButton('initiated', t('initiated'))}
        {renderFilterButton('released', t('released'))}
        {renderFilterButton('refunded', t('refunded'))}
        {renderFilterButton('failed', t('failed'))}
      </ScrollView>

      {/* Export Buttons */}
      {filteredPayments.length > 0 && (
        <View style={styles.exportContainer}>
          <TouchableOpacity style={styles.exportButton} onPress={handleExportPDF}>
            <Ionicons name="document-text-outline" size={20} color={theme.iconColors.primary} />
            <Text style={styles.exportButtonText}>{t('exportPDF')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportButton} onPress={handleEmailReport}>
            <Ionicons name="mail-outline" size={20} color={theme.iconColors.primary} />
            <Text style={styles.exportButtonText}>{t('exportEmail')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Payments List */}
      <ScrollView style={styles.scrollView}>
        {filteredPayments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={64} color={theme.iconColors.gray.light} />
            <Text style={styles.emptyTitle}>{t('noPaymentsYet')}</Text>
            <Text style={styles.emptyDescription}>{t('noPaymentsDescription')}</Text>
          </View>
        ) : (
          filteredPayments.map(payment => (
            <ScreenSection key={payment.id}>
              <View style={styles.paymentHeader}>
                <View style={styles.paymentHeaderLeft}>
                  <Ionicons
                    name={getStatusIcon(payment.status)}
                    size={24}
                    color={getStatusColor(payment.status)}
                  />
                  <View style={styles.paymentHeaderText}>
                    <Text style={styles.paymentTitle}>
                      {payment.order?.title || 'Cargo Transport'}
                    </Text>
                    <Text style={styles.paymentDate}>{formatDate(payment.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.paymentAmount}>
                  <Text style={styles.paymentAmountText}>
                    {payment.amount} {payment.currency}
                  </Text>
                </View>
              </View>

              <View style={styles.paymentDetails}>
                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>{t('paymentStatus')}:</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${getStatusColor(payment.status)}20` },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: getStatusColor(payment.status) }]}>
                      {t(payment.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.paymentDetailRow}>
                  <Text style={styles.paymentDetailLabel}>{t('paymentMethod')}:</Text>
                  <Text style={styles.paymentDetailValue}>{payment.payment_method}</Text>
                </View>

                {payment.vipps_order_id && (
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Vipps Order:</Text>
                    <Text style={styles.paymentDetailValue} numberOfLines={1}>
                      {payment.vipps_order_id}
                    </Text>
                  </View>
                )}

                {payment.order && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.routeInfo}>
                      <View style={styles.routeRow}>
                        <Ionicons
                          name="location-outline"
                          size={16}
                          color={theme.iconColors.gray.primary}
                        />
                        <Text style={styles.routeText} numberOfLines={1}>
                          {payment.order.from_address}
                        </Text>
                      </View>
                      <View style={styles.routeRow}>
                        <Ionicons
                          name="navigate-outline"
                          size={16}
                          color={theme.iconColors.gray.primary}
                        />
                        <Text style={styles.routeText} numberOfLines={1}>
                          {payment.order.to_address}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>

              <TouchableOpacity
                style={styles.viewOrderButton}
                onPress={() => router.push(`/payment/${payment.order_id}` as any)}
              >
                <Text style={styles.viewOrderButtonText}>{t('viewDetails')}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.iconColors.primary} />
              </TouchableOpacity>
            </ScreenSection>
          ))
        )}
      </ScrollView>

      {/* Email Modal */}
      <Modal
        visible={emailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('exportEmail')}</Text>
              <TouchableOpacity onPress={() => setEmailModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.iconColors.gray.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>{t('enterEmailAddress')}</Text>

            <TextInput
              style={styles.emailInput}
              placeholder="example@email.com"
              value={emailAddress}
              onChangeText={setEmailAddress}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity style={styles.sendButton} onPress={sendEmailReport}>
              <Text style={styles.sendButtonText}>{t('sendReport')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: '#FFF4F0',
    borderColor: theme.iconColors.primary,
  },
  filterButtonText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  filterButtonTextActive: {
    color: theme.iconColors.primary,
    fontWeight: fontWeight.semibold,
  },
  exportContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: 'white',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: '#F3F4F6',
    gap: spacing.xs,
  },
  exportButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: theme.iconColors.primary,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    fontSize: fontSize.md,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  paymentCard: {
    backgroundColor: 'white',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
  },
  paymentHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  paymentHeaderText: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  paymentAmount: {
    alignItems: 'flex-end',
  },
  paymentAmountText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: theme.iconColors.primary,
  },
  paymentDetails: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentDetailLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  paymentDetailValue: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
    maxWidth: '60%',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'capitalize',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: spacing.sm,
  },
  routeInfo: {
    gap: spacing.xs,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  routeText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  viewOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: spacing.xs,
  },
  viewOrderButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: theme.iconColors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalContent: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  modalDescription: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
  },
  sendButton: {
    backgroundColor: theme.iconColors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: 'white',
  },
});
