import { useState, useEffect } from 'react';
import { RealtimePostgresChangesFilter } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

type CollectionSelectQuery = ReturnType<ReturnType<typeof supabase.from>['select']>;
type CollectionQueryBuilder = (_query: CollectionSelectQuery) => CollectionSelectQuery;

interface UseSupabaseCollectionOptions {
  queryBuilder?: CollectionQueryBuilder;
  realtime?: {
    event?: RealtimeEvent;
    filter?: RealtimePostgresChangesFilter<'*'>['filter'];
  };
}

/**
 * Custom hook to listen to a Firestore collection in real-time
 */
export const useFirestoreCollection = <T>(
  collectionName: string,
  options: UseSupabaseCollectionOptions = {}
) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        setLoading(true);

        let query = supabase.from(collectionName).select('*');

        if (options.queryBuilder) {
          query = options.queryBuilder(query);
        }

        const { data: items, error: queryError } = await query;

        if (queryError) {
          throw queryError;
        }

        setData((items || []) as T[]);
        setError(null);
      } catch (err) {
        console.error(`Error fetching ${collectionName}:`, err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();

    const channel = supabase
      .channel(`${collectionName}:collection-listener`)
      .on(
        'postgres_changes',
        {
          event: options.realtime?.event || '*',
          schema: 'public',
          table: collectionName,
          filter: options.realtime?.filter,
        },
        fetchCollection
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [collectionName, options]);

  return { data, loading, error };
};

export default useFirestoreCollection;
