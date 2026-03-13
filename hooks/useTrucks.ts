import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Truck {
  id: string;
  carrier_id: string;
  plate_number: string;
  model: string;
  year: number | null;
  capacity_kg: number | null;
  volume_m3: number | null;
  truck_type: 'standard' | 'refrigerated' | 'flatbed' | 'tanker' | 'other';
  status: 'active' | 'inactive' | 'maintenance';
  home_city: string | null;
  created_at: string;
  updated_at: string;
}

export type TruckInput = Omit<Truck, 'id' | 'carrier_id' | 'created_at' | 'updated_at'>;

/** Hook: list the current carrier's trucks */
export function useTrucks() {
  const { user } = useAuth();
  const uid = user?.uid;

  const query = useQuery({
    queryKey: ['trucks', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trucks')
        .select('*')
        .eq('carrier_id', uid!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as unknown as Truck[];
    },
    enabled: Boolean(uid),
    staleTime: 60_000,
  });

  return {
    trucks: query.data ?? [],
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/** Add a new truck (invalidates the trucks list cache) */
export async function addTruck(
  carrierId: string,
  input: TruckInput
): Promise<{ data: Truck | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('trucks')
    .insert({ ...input, carrier_id: carrierId })
    .select()
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as unknown as Truck, error: null };
}

/** Update an existing truck */
export async function updateTruck(
  truckId: string,
  input: Partial<TruckInput>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('trucks')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', truckId);

  return { error: error ? new Error(error.message) : null };
}

/** Delete a truck */
export async function deleteTruck(truckId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('trucks').delete().eq('id', truckId);
  return { error: error ? new Error(error.message) : null };
}

/** Call after add/update/delete to refresh the truck list */
export function useInvalidateTrucks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['trucks', user?.uid] });
}
