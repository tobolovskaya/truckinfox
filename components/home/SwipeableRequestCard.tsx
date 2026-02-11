import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RequestCard } from './RequestCard';
import { colors, spacing } from '../../lib/sharedStyles';
import { triggerHapticFeedback } from '../../utils/haptics';

interface CargoRequest {
  id: string;
  title: string;
  description: string;
  cargo_type: string;
  weight: number;
  dimensions?: string;
  from_address: string;
  to_address: string;
  pickup_date: string;
  delivery_date?: string;
  price: number;
  price_type: string;
  status: string;
  created_at: string;
  user_id: string;
  distance?: number;
  users: {
    full_name: string;
    user_type: string;
    rating: number;
    avatar_url?: string;
  };
  bids: any[];
  is_favorite?: boolean;
  user_favorites?: { id: string; user_id: string }[];
  images?: string[];
}

interface SwipeableRequestCardProps {
  request: CargoRequest;
  onPress: (request: CargoRequest) => void;
  onToggleFavorite: (requestId: string) => void;
  onDelete?: (requestId: string) => void;
  showDeleteAction?: boolean;
  isOwner?: boolean;
}

export const SwipeableRequestCard: React.FC<SwipeableRequestCardProps> = ({
  request,
  onPress,
  onToggleFavorite,
  onDelete,
  showDeleteAction = false,
  isOwner = false,
}) => {
  const { t } = useTranslation();
  const swipeableRef = useRef<Swipeable>(null);

  const handleFavorite = () => {
    triggerHapticFeedback.light();
    onToggleFavorite(request.id);
    swipeableRef.current?.close();
  };

  const handleDelete = () => {
    if (!onDelete) return;

    triggerHapticFeedback.medium();
    Alert.alert(
      t('confirmDelete') || 'Delete Request',
      t('confirmDeleteMessage') || 'Are you sure you want to delete this request?',
      [
        {
          text: t('cancel') || 'Cancel',
          style: 'cancel',
          onPress: () => swipeableRef.current?.close(),
        },
        {
          text: t('delete') || 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(request.id);
            swipeableRef.current?.close();
          },
        },
      ]
    );
  };

  const renderLeftActions = () => (
    <TouchableOpacity
      style={[styles.swipeAction, { backgroundColor: colors.primary }]}
      onPress={handleFavorite}
      activeOpacity={0.8}
    >
      <Ionicons
        name={request.is_favorite ? 'heart' : 'heart-outline'}
        size={28}
        color="white"
      />
      <Text style={styles.swipeActionText}>
        {request.is_favorite ? t('unfavorite') || 'Unfavorite' : t('favorite') || 'Favorite'}
      </Text>
    </TouchableOpacity>
  );

  const renderRightActions = () => {
    if (!showDeleteAction || !isOwner) return null;

    return (
      <TouchableOpacity
        style={[styles.swipeAction, { backgroundColor: colors.error }]}
        onPress={handleDelete}
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={28} color="white" />
        <Text style={styles.swipeActionText}>{t('delete') || 'Delete'}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
      leftThreshold={80}
      rightThreshold={80}
    >
      <RequestCard
        request={request}
        onPress={onPress}
        onToggleFavorite={onToggleFavorite}
      />
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  swipeActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
