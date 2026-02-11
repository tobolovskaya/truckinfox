import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, QueryConstraint } from 'firebase/firestore';
import { firestore } from '../lib/firebase';

/**
 * Custom hook to listen to a Firestore collection in real-time
 */
export const useFirestoreCollection = <T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const collectionRef = collection(firestore, collectionName);
    const q = query(collectionRef, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];

        setData(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error listening to ${collectionName}:`, err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, ...constraints]);

  return { data, loading, error };
};

export default useFirestoreCollection;
