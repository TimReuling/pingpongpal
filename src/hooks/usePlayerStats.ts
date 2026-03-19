import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlayerStatWithName {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  total_points_scored: number;
  total_points_conceded: number;
  current_win_streak: number;
  best_win_streak: number;
}

export function usePlayerStats() {
  const [stats, setStats] = useState<PlayerStatWithName[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const { data } = await supabase
      .from('player_stats')
      .select(`
        *,
        profile:profiles!player_stats_profile_id_fkey(display_name, avatar_url)
      `)
      .order('matches_won', { ascending: false });

    if (data) {
      const mapped = data.map((s: any) => ({
        profile_id: s.profile_id,
        display_name: s.profile?.display_name ?? 'Unknown',
        avatar_url: s.profile?.avatar_url ?? null,
        matches_played: s.matches_played,
        matches_won: s.matches_won,
        matches_lost: s.matches_lost,
        total_points_scored: s.total_points_scored,
        total_points_conceded: s.total_points_conceded,
        current_win_streak: s.current_win_streak,
        best_win_streak: s.best_win_streak,
      }));
      setStats(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
