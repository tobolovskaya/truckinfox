import {
  collection,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  getDocs,
  QueryConstraint,
  DocumentData,
  CollectionReference,
  Query,
} from 'firebase/firestore';
import { firestore } from './firebase';

/**
 * Helper function to build Firestore queries
 */
export const buildQuery = (
  collectionName: string,
  constraints: QueryConstraint[]
): Query<DocumentData> => {
  const collectionRef: CollectionReference<DocumentData> = collection(firestore, collectionName);
  return query(collectionRef, ...constraints);
};

/**
 * Fetch documents from a collection with constraints
 */
export const fetchDocuments = async (
  collectionName: string,
  constraints: QueryConstraint[] = []
) => {
  try {
    const q = buildQuery(collectionName, constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching documents from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Fetch a single document by id
 */
export const getDocument = async <T = DocumentData>(
  collectionName: string,
  documentId: string
): Promise<T | null> => {
  try {
    const documentRef = doc(firestore, collectionName, documentId);
    const snapshot = await getDoc(documentRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data() as T;
  } catch (error) {
    console.error(`Error fetching document ${collectionName}/${documentId}:`, error);
    throw error;
  }
};

/**
 * Fetch cargo requests with filters
 */
export const fetchCargoRequests = async (status?: string, userId?: string) => {
  const constraints: QueryConstraint[] = [];

  if (status) {
    constraints.push(where('status', '==', status));
  }

  if (userId) {
    constraints.push(where('customerId', '==', userId));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(50));

  return fetchDocuments('cargoRequests', constraints);
};

/**
 * Fetch bids for a cargo request
 */
export const fetchBidsForRequest = async (requestId: string) => {
  const constraints: QueryConstraint[] = [
    where('requestId', '==', requestId),
    orderBy('createdAt', 'desc'),
  ];

  return fetchDocuments('bids', constraints);
};

/**
 * Fetch messages for a chat
 */
export const fetchChatMessages = async (chatId: string, limitCount = 50) => {
  const constraints: QueryConstraint[] = [
    where('chatId', '==', chatId),
    orderBy('createdAt', 'asc'),
    limit(limitCount),
  ];

  return fetchDocuments('messages', constraints);
};

/**
 * Fetch notifications for a user
 */
export const fetchUserNotifications = async (userId: string, unreadOnly = false) => {
  const constraints: QueryConstraint[] = [where('userId', '==', userId)];

  if (unreadOnly) {
    constraints.push(where('read', '==', false));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(50));

  return fetchDocuments('notifications', constraints);
};
