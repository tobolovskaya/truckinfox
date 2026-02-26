import { useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { triggerHapticFeedback } from '../utils/haptics';
import { i18n } from '../lib/i18n';

/**
 * Custom hook for managing favorite cargo requests
 * Provides optimistic updates with proper error handling and rollback
 */
export function useFavorites(userId?: string) {
  const toggleFavorite = useCallback(
    async (
      requestId: string,
      isFavorite: boolean,
      onSuccess?: (_newFavoriteStatus: boolean) => void
    ) => {
      try {
        if (!userId) {
          Alert.alert(i18n.t('error'), i18n.t('favoriteLoginRequired'));
          return;
        }

        // Haptic feedback for instant user response
        triggerHapticFeedback.light();

        if (isFavorite) {
          // Remove from favorites
          const { error } = await supabase
            .from('user_favorites')
            .delete()
            .eq('user_id', userId)
            .eq('request_id', requestId);

          if (error) {
            throw error;
          }

          // Call success callback with new status
          onSuccess?.(false);
        } else {
          // Add to favorites
          const { error } = await supabase.from('user_favorites').insert({
            user_id: userId,
            request_id: requestId,
            created_at: new Date().toISOString(),
          });

          if (error) {
            throw error;
          }

          // Call success callback with new status
          onSuccess?.(true);
        }
      } catch (error) {
        console.error('Error toggling favorite:', error);

        // Rollback optimistic update by calling callback with original status
        onSuccess?.(isFavorite);

        Alert.alert(i18n.t('error'), i18n.t('favoriteUpdateFailed'));
      }
    },
    [userId]
  );

  const addFavorite = useCallback(
    async (requestId: string, onSuccess?: () => void) => {
      try {
        if (!userId) {
          Alert.alert(i18n.t('error'), i18n.t('favoriteLoginRequired'));
          return;
        }

        triggerHapticFeedback.light();

        const { error } = await supabase.from('user_favorites').insert({
          user_id: userId,
          request_id: requestId,
          created_at: new Date().toISOString(),
        });

        if (error) {
          throw error;
        }
        onSuccess?.();
      } catch (error) {
        console.error('Error adding favorite:', error);
        Alert.alert(i18n.t('error'), i18n.t('favoriteAddFailed'));
      }
    },
    [userId]
  );

  const removeFavorite = useCallback(
    async (requestId: string, onSuccess?: () => void) => {
      try {
        if (!userId) {
          Alert.alert(i18n.t('error'), i18n.t('favoriteLoginRequired'));
          return;
        }

        triggerHapticFeedback.light();

        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('request_id', requestId);

        if (error) {
          throw error;
        }
        onSuccess?.();
      } catch (error) {
        console.error('Error removing favorite:', error);
        Alert.alert(i18n.t('error'), i18n.t('favoriteRemoveFailed'));
      }
    },
    [userId]
  );

  return {
    toggleFavorite,
    addFavorite,
    removeFavorite,
  };
}
