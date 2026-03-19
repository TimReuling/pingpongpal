import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MatchWithPlayers {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  target_score: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  player1_name: string;
  player2_name: string;
  winner_name: string | null;
}

export function useMatchHistory() {
  const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    const { data } = await supabase
      .from('matches')
      .select(`
        *,
        player1:profiles!matches_player1_id_fkey(display_name),
        player2:profiles!matches_player2_id_fkey(display_name),
        winner:profiles!matches_winner_id_fkey(display_name)
      `)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(50);

    if (data) {
      const mapped = data.map((m: any) => ({
        ...m,
        player1_name: m.player1?.display_name ?? 'Unknown',
        player2_name: m.player2?.display_name ?? 'Unknown',
        winner_name: m.winner?.display_name ?? null,
      }));
      setMatches(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  return { matches, loading, refetch: fetchMatches };
}
