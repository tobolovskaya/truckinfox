/**
 * Safe Firestore Operations with Automatic Offline Fallback
 *
 * These utilities wrap Firestore operations to automatically handle offline scenarios
 * by queuing operations locally and syncing when connection is restored
 */

import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  collection,
  query,
  getDocs,
  addDoc,
  QueryConstraint,
  WriteBatch,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { queueOfflineOperation } from './offlineSync';

/**
 * Safely set document with offline fallback
 */
export const safeSetDoc = async (
  collectionName: string,
  documentId: string,
  data: any,
  merge = false
): Promise<{ success: boolean; fromCache?: boolean; error?: string }> => {
  try {
    const docRef = doc(db, collectionName, documentId);
    await setDoc(
      docRef,
      {
        ...data,
        updatedAt: serverTimestamp(),
      },
      { merge }
    );

    console.log(`✅ Document set: ${collectionName}/${documentId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Queue operation if offline
    if (errorMessage.includes('offline') || errorMessage.includes('connectivity')) {
      queueOfflineOperation(collectionName, merge ? 'update' : 'create', documentId, {
        ...data,
        id: documentId,
      });
      return { success: true, fromCache: true };
    }

    console.error(`❌ Failed to set document: ${collectionName}/${documentId}`, error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Safely update document with offline fallback
 */
export const safeUpdateDoc = async (
  collectionName: string,
  documentId: string,
  data: any
): Promise<{ success: boolean; fromCache?: boolean; error?: string }> => {
  try {
    const docRef = doc(db, collectionName, documentId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ Document updated: ${collectionName}/${documentId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Queue operation if offline
    if (errorMessage.includes('offline') || errorMessage.includes('connectivity')) {
      queueOfflineOperation(collectionName, 'update', documentId, {
        ...data,
        id: documentId,
      });
      return { success: true, fromCache: true };
    }

    console.error(`❌ Failed to update document: ${collectionName}/${documentId}`, error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Safely delete document with offline fallback
 */
export const safeDeleteDoc = async (
  collectionName: string,
  documentId: string
): Promise<{ success: boolean; fromCache?: boolean; error?: string }> => {
  try {
    const docRef = doc(db, collectionName, documentId);
    await deleteDoc(docRef);

    console.log(`✅ Document deleted: ${collectionName}/${documentId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Queue operation if offline
    if (errorMessage.includes('offline') || errorMessage.includes('connectivity')) {
      queueOfflineOperation(collectionName, 'delete', documentId, { id: documentId });
      return { success: true, fromCache: true };
    }

    console.error(`❌ Failed to delete document: ${collectionName}/${documentId}`, error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Safely get document (works offline from cache)
 */
export const safeGetDoc = async (
  collectionName: string,
  documentId: string
): Promise<{ data: any; fromCache: boolean; exists: boolean; error?: string }> => {
  try {
    const docRef = doc(db, collectionName, documentId);
    const docSnap = await getDoc(docRef);

    const fromCache = docSnap.metadata.fromCache;
    const exists = docSnap.exists();

    if (exists) {
      console.log(
        `📖 Document retrieved (${fromCache ? 'from cache' : 'from server'}): ${collectionName}/${documentId}`
      );
      return {
        data: { id: docSnap.id, ...docSnap.data() },
        fromCache,
        exists: true,
      };
    }

    return { data: null, fromCache, exists: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Failed to get document: ${collectionName}/${documentId}`, error);
    return { data: null, fromCache: false, exists: false, error: errorMessage };
  }
};

/**
 * Safely query collection (works offline from cache)
 */
export const safeQuery = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<{ documents: any[]; fromCache: boolean; error?: string }> => {
  try {
    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);

    const documents = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    const fromCache = querySnapshot.metadata.fromCache;

    console.log(
      `📖 Query executed (${fromCache ? 'from cache' : 'from server'}): ${collectionName}`,
      {
        count: documents.length,
        constraints: constraints.length,
      }
    );

    return { documents, fromCache };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Query failed: ${collectionName}`, error);
    return { documents: [], fromCache: false, error: errorMessage };
  }
};

/**
 * Safely add document with offline fallback
 */
export const safeAddDoc = async (
  collectionName: string,
  data: any
): Promise<{ id?: string; success: boolean; fromCache?: boolean; error?: string }> => {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    console.log(`✅ Document added: ${collectionName}/${docRef.id}`);
    return { success: true, id: docRef.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Queue operation if offline (generate temporary ID)
    if (errorMessage.includes('offline') || errorMessage.includes('connectivity')) {
      const tempId = `offline_${Date.now()}_${Math.random()}`;
      queueOfflineOperation(collectionName, 'create', tempId, {
        ...data,
        id: tempId,
      });
      return { success: true, id: tempId, fromCache: true };
    }

    console.error(`❌ Failed to add document: ${collectionName}`, error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Safe batch write with offline fallback
 */
export const safeBatchWrite = async (
  operations: Array<{
    type: 'set' | 'update' | 'delete';
    collection: string;
    id: string;
    data?: any;
  }>
): Promise<{ success: boolean; queued?: number; error?: string }> => {
  try {
    const batch = writeBatch(db);

    for (const op of operations) {
      const docRef = doc(db, op.collection, op.id);

      switch (op.type) {
        case 'set':
          batch.set(docRef, op.data || {});
          break;
        case 'update':
          batch.update(docRef, op.data || {});
          break;
        case 'delete':
          batch.delete(docRef);
          break;
      }
    }

    await batch.commit();
    console.log(`✅ Batch write completed: ${operations.length} operations`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Queue all operations if batch fails offline
    if (errorMessage.includes('offline') || errorMessage.includes('connectivity')) {
      let queuedCount = 0;
      for (const op of operations) {
        queueOfflineOperation(op.collection, op.type as any, op.id, {
          ...op.data,
          id: op.id,
        });
        queuedCount++;
      }
      return { success: true, queued: queuedCount };
    }

    console.error('❌ Batch write failed:', error);
    return { success: false, error: errorMessage };
  }
};
