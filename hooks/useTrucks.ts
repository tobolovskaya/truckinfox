import { useState, useEffect, useCallback } from 'react';
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
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadTrucks = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('trucks')
      .select('*')
      .eq('carrier_id', user.uid)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(new Error(fetchError.message));
    } else {
      setTrucks((data || []) as Truck[]);
    }
    setLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    loadTrucks();
  }, [loadTrucks]);

  return { trucks, loading, error, refetch: loadTrucks };
}

/** Add a new truck */
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
  return { data: data as Truck, error: null };
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
