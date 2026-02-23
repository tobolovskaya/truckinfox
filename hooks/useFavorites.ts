import { useCallback } from 'react';
import { Alert } from 'react-native';
import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
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
          const favoritesQuery = query(
            collection(db, 'user_favorites'),
            where('user_id', '==', userId),
            where('request_id', '==', requestId)
          );
          const snapshot = await getDocs(favoritesQuery);
          await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));

          // Call success callback with new status
          onSuccess?.(false);
        } else {
          // Add to favorites
          await addDoc(collection(db, 'user_favorites'), {
            user_id: userId,
            request_id: requestId,
            created_at: serverTimestamp(),
          });

          // Call success callback with new status
          onSuccess?.(true);
        }
      } catch (error: any) {
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

        await addDoc(collection(db, 'user_favorites'), {
          user_id: userId,
          request_id: requestId,
          created_at: serverTimestamp(),
        });
        onSuccess?.();
      } catch (error: any) {
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

        const favoritesQuery = query(
          collection(db, 'user_favorites'),
          where('user_id', '==', userId),
          where('request_id', '==', requestId)
        );
        const snapshot = await getDocs(favoritesQuery);
        await Promise.all(snapshot.docs.map(doc => deleteDoc(doc.ref)));
        onSuccess?.();
      } catch (error: any) {
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
