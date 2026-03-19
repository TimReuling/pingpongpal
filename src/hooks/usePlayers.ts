import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export function usePlayers(userId: string | undefined) {
  const [players, setPlayers] = useState<Tables<'profiles'>[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlayers = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('display_name');
    setPlayers(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const addGuest = async (name: string) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('profiles')
      .insert({ display_name: name, is_guest: true, created_by: userId })
      .select()
      .single();
    if (!error && data) {
      await fetchPlayers();
      return data;
    }
    return null;
  };

  const deleteGuest = async (profileId: string) => {
    await supabase.from('profiles').delete().eq('id', profileId);
    await fetchPlayers();
  };

  return { players, loading, addGuest, deleteGuest, refetch: fetchPlayers };
}
