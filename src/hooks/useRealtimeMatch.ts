import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RealtimeMatchState {
  matchId: string;
  player1Score: number;
  player2Score: number;
  server: number;
  firstServer: number;
  targetScore: number;
  status: string;
  winnerId: string | null;
  player1Id: string;
  player2Id: string;
}

export function useRealtimeMatch(matchId: string | null) {
  const [match, setMatch] = useState<RealtimeMatchState | null>(null);
  const [loading, setLoading] = useState(true);

  const toRealtimeState = useCallback((data: any): RealtimeMatchState => ({
    matchId: data.id,
    player1Score: data.player1_score,
    player2Score: data.player2_score,
    server: data.server,
    firstServer: data.first_server,
    targetScore: data.target_score,
    status: data.status === 'completed' ? 'finished' : data.status,
    winnerId: data.winner_id,
    player1Id: data.player1_id,
    player2Id: data.player2_id,
  }), []);

  // Fetch initial match data
  useEffect(() => {
    if (!matchId) { setLoading(false); return; }

    const fetch = async () => {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();
      if (data) {
        setMatch(toRealtimeState(data));
      }
      setLoading(false);
    };
    fetch();
  }, [matchId, toRealtimeState]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const d = payload.new as any;
          setMatch(toRealtimeState(d));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, toRealtimeState]);

  const updateScore = useCallback(async (player: 1 | 2, delta: 1 | -1) => {
    if (!matchId) return null;

    const { data, error } = await supabase.rpc('update_match_score', {
      p_match_id: matchId,
      p_player: player,
      p_delta: delta,
    });

    if (error || !data) {
      console.error('Failed to update live match score', error);
      return null;
    }

    const nextState = toRealtimeState(data);
    setMatch(nextState);
    return nextState;
  }, [matchId, toRealtimeState]);

  const closeMatch = useCallback(async (status: 'finished' | 'cancelled' | 'abandoned') => {
    if (!matchId) return null;

    const { data, error } = await supabase.rpc('finalize_match_session', {
      p_match_id: matchId,
      p_status: status,
      p_closed_by_profile_id: null,
    });

    if (error) {
      console.error('Failed to close match session', error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    setMatch((prev) => prev ? { ...prev, status: row.status, winnerId: row.winner_id ?? prev.winnerId } : prev);
    return row;
  }, [matchId]);

  return { match, loading, updateScore, closeMatch };
}
