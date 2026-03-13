import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useCities() {
  const query = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cargo_requests')
        .select('from_address,to_address');
      if (error) throw error;

      const citySet = new Set<string>();
      (data || []).forEach(item => {
        if (item.from_address) {
          const parts = item.from_address.split(',');
          if (parts.length > 0) citySet.add(parts[0].trim());
        }
        if (item.to_address) {
          const parts = item.to_address.split(',');
          if (parts.length > 0) citySet.add(parts[0].trim());
        }
      });
      return Array.from(citySet).sort();
    },
    staleTime: 5 * 60_000, // cities change infrequently — 5 min cache
  });

  return {
    cities: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}
