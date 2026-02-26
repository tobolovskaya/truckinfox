import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useCities() {
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCities = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cargo_requests')
        .select('from_address,to_address');

      if (error) {
        throw error;
      }

      const citySet = new Set<string>();
      (data || []).forEach(item => {
        // Extract city from address (simple approach)
        if (item.from_address) {
          const parts = item.from_address.split(',');
          if (parts.length > 0) {
            citySet.add(parts[0].trim());
          }
        }
        if (item.to_address) {
          const parts = item.to_address.split(',');
          if (parts.length > 0) {
            citySet.add(parts[0].trim());
          }
        }
      });

      setCities(Array.from(citySet).sort());
    } catch (error) {
      console.error('Error fetching cities:', error);
      setCities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCities();
  }, [fetchCities]);

  return {
    cities,
    loading,
    refetch: fetchCities,
  };
}
