import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Custom hook to listen to a Firestore document in real-time
 */
export const useFirestoreDocument = <T>(collectionName: string, documentId: string) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!documentId) {
      setData(null);
      setLoading(false);
      return;
    }

    const fetchDocument = async () => {
      try {
        setLoading(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: row, error: fetchError } = await (supabase as any)
          .from(collectionName)
          .select('*')
          .eq('id', documentId)
          .maybeSingle();

        if (fetchError) {
          throw fetchError;
        }

        if (row) {
          setData({ id: documentId, ...row } as unknown as T);
        } else {
          setData(null);
        }

        setError(null);
      } catch (err) {
        console.error(`Error listening to ${collectionName}/${documentId}:`, err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();

    const channel = supabase
      .channel(`${collectionName}:${documentId}:document-listener`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: collectionName,
          filter: `id=eq.${documentId}`,
        },
        fetchDocument
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [collectionName, documentId]);

  return { data, loading, error };
};

export default useFirestoreDocument;
