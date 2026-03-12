import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { type Bid, acceptBid } from '../hooks/useBids';
import { colors, spacing, fontSize, borderRadius } from '../lib/sharedStyles';

type SortKey = 'price' | 'rating';

type Props = {
  bids: Bid[];
  requestStatus: string;
  onBidAccepted: (orderId: string) => void;
};

function formatExpiry(expiresAt: string, t: (key: string, opts?: object) => string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return t('bidExpired');
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return t('expiresIn', { time: `${hours}h` });
  const days = Math.floor(hours / 24);
  return t('expiresIn', { time: `${days}d` });
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= full ? 'star' : 'star-outline'}
          size={11}
          color={i <= full ? '#F59E0B' : '#D1D5DB'}
        />
      ))}
    </View>
  );
}

export function BidComparisonTable({ bids, requestStatus, onBidAccepted }: Props) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<SortKey>('price');
  const [accepting, setAccepting] = useState<string | null>(null);

  const canAccept = ['open', 'bidding'].includes(requestStatus);

  const activeBids = useMemo(
    () => bids.filter(b => b.status === 'pending'),
    [bids]
  );

  const sorted = useMemo(() => {
    const copy = [...activeBids];
    if (sort === 'price') return copy.sort((a, b) => a.price - b.price);
    return copy.sort((a, b) => (b.carrier?.rating ?? 0) - (a.carrier?.rating ?? 0));
  }, [activeBids, sort]);

  const lowestPrice = useMemo(
    () => (sorted.length ? sorted[0].price : null),
    [sorted]
  );

  const handleAccept = (bid: Bid) => {
    const carrierName = bid.carrier?.full_name ?? t('carrier');
    Alert.alert(
      t('acceptBid'),
      t('acceptBidConfirmation', { amount: bid.price, carrier: carrierName }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('acceptBid'),
          style: 'default',
          onPress: async () => {
            setAccepting(bid.id);
            const { orderId, error } = await acceptBid(bid.id);
            setAccepting(null);
            if (error) {
              Alert.alert(t('error'), error.message);
              return;
            }
            if (orderId) onBidAccepted(orderId);
          },
        },
      ]
    );
  };

  if (!bids.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
        <Text style={styles.emptyTitle}>{t('noBidsYet')}</Text>
        <Text style={styles.emptyDesc}>{t('noBidsDescription')}</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {t('bidsComparison')}
          <Text style={styles.headerCount}> ({activeBids.length})</Text>
        </Text>
        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortPill, sort === 'price' && styles.sortPillActive]}
            onPress={() => setSort('price')}
          >
            <Text style={[styles.sortPillText, sort === 'price' && styles.sortPillTextActive]}>
              {t('sortByPrice')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortPill, sort === 'rating' && styles.sortPillActive]}
            onPress={() => setSort('rating')}
          >
            <Text style={[styles.sortPillText, sort === 'rating' && styles.sortPillTextActive]}>
              {t('sortByRating')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bid cards */}
      <ScrollView scrollEnabled={false}>
        {sorted.map((bid, index) => {
          const isBest = sort === 'price' && bid.price === lowestPrice && index === 0;
          const isExpired = new Date(bid.expires_at).getTime() < Date.now();
          const isAccepting = accepting === bid.id;
          const initials = (bid.carrier?.full_name ?? '?')
            .split(' ')
            .map(w => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

          return (
            <View
              key={bid.id}
              style={[styles.card, isBest && styles.cardBest, isExpired && styles.cardExpired]}
            >
              {isBest && (
                <View style={styles.bestBadge}>
                  <Ionicons name="trophy" size={11} color="#fff" />
                  <Text style={styles.bestBadgeText}>{t('bestValue')}</Text>
                </View>
              )}

              {/* Top row: avatar + carrier info + price */}
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>

                <View style={styles.carrierInfo}>
                  <View style={styles.carrierNameRow}>
                    <Text style={styles.carrierName} numberOfLines={1}>
                      {bid.carrier?.full_name ?? t('carrier')}
                    </Text>
                    {bid.carrier?.is_verified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                        <Text style={styles.verifiedText}>{t('verifiedCarrier')}</Text>
                      </View>
                    )}
                  </View>
                  <StarRating rating={bid.carrier?.rating ?? 0} />
                </View>

                <View style={styles.priceBlock}>
                  <Text style={[styles.price, isBest && styles.priceBest]}>
                    {bid.price.toLocaleString('nb-NO')}
                  </Text>
                  <Text style={styles.priceCurrency}>{bid.currency} NOK</Text>
                </View>
              </View>

              {/* Meta row: estimated days + expiry */}
              <View style={styles.metaRow}>
                {bid.estimated_days != null && (
                  <View style={styles.metaChip}>
                    <Ionicons name="time-outline" size={12} color="#6B7280" />
                    <Text style={styles.metaChipText}>
                      {bid.estimated_days} {t('estimatedDays')}
                    </Text>
                  </View>
                )}
                <View style={[styles.metaChip, isExpired && styles.metaChipExpired]}>
                  <Ionicons
                    name="hourglass-outline"
                    size={12}
                    color={isExpired ? '#EF4444' : '#6B7280'}
                  />
                  <Text style={[styles.metaChipText, isExpired && styles.metaChipTextExpired]}>
                    {formatExpiry(bid.expires_at, t)}
                  </Text>
                </View>
              </View>

              {/* Note */}
              {!!bid.note && (
                <View style={styles.noteBlock}>
                  <Text style={styles.noteLabel}>{t('carrierNote')}</Text>
                  <Text style={styles.noteText} numberOfLines={3}>{bid.note}</Text>
                </View>
              )}

              {/* Accept button */}
              {canAccept && !isExpired && (
                <TouchableOpacity
                  style={[styles.acceptBtn, isBest && styles.acceptBtnBest, isAccepting && styles.acceptBtnLoading]}
                  onPress={() => handleAccept(bid)}
                  disabled={accepting !== null}
                  activeOpacity={0.8}
                >
                  {isAccepting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                      <Text style={styles.acceptBtnText}>{t('acceptBid')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#374151',
    marginTop: spacing.xs,
  },
  emptyDesc: {
    fontSize: fontSize.sm,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
  header: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#111827',
  },
  headerCount: {
    fontWeight: '400',
    color: '#6B7280',
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sortPill: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: '#F9FAFB',
  },
  sortPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sortPillText: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    fontWeight: '500',
  },
  sortPillTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.lg,
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardBest: {
    borderColor: colors.primary,
    borderWidth: 2,
    shadowOpacity: 0.1,
    elevation: 3,
  },
  cardExpired: {
    opacity: 0.55,
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  bestBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#fff',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.primary,
  },
  carrierInfo: {
    flex: 1,
    gap: 3,
  },
  carrierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  carrierName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#111827',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  verifiedText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: '600',
  },
  stars: {
    flexDirection: 'row',
    gap: 1,
  },
  priceBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  price: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: '#111827',
  },
  priceBest: {
    color: colors.primary,
  },
  priceCurrency: {
    fontSize: fontSize.xs,
    color: '#9CA3AF',
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  metaChipExpired: {
    backgroundColor: '#FEF2F2',
  },
  metaChipText: {
    fontSize: fontSize.xs,
    color: '#6B7280',
    fontWeight: '500',
  },
  metaChipTextExpired: {
    color: '#EF4444',
  },
  noteBlock: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    gap: 3,
  },
  noteLabel: {
    fontSize: fontSize.xs,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noteText: {
    fontSize: fontSize.sm,
    color: '#374151',
    lineHeight: 19,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#374151',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  acceptBtnBest: {
    backgroundColor: colors.primary,
  },
  acceptBtnLoading: {
    opacity: 0.7,
  },
  acceptBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
});
