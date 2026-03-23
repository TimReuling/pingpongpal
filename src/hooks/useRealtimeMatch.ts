import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateServer, checkWinner } from '@/lib/scoring';

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
  const updatingRef = useRef(false);

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
        setMatch({
          matchId: data.id,
          player1Score: data.player1_score,
          player2Score: data.player2_score,
          server: data.server,
          firstServer: data.first_server,
          targetScore: data.target_score,
          status: data.status,
          winnerId: data.winner_id,
          player1Id: data.player1_id,
          player2Id: data.player2_id,
        });
      }
      setLoading(false);
    };
    fetch();
  }, [matchId]);

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
          // Don't overwrite if we're the one who just updated
          if (updatingRef.current) {
            updatingRef.current = false;
            return;
          }
          const d = payload.new as any;
          setMatch({
            matchId: d.id,
            player1Score: d.player1_score,
            player2Score: d.player2_score,
            server: d.server,
            firstServer: d.first_server,
            targetScore: d.target_score,
            status: d.status,
            winnerId: d.winner_id,
            player1Id: d.player1_id,
            player2Id: d.player2_id,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  const updateScore = useCallback(async (player: 1 | 2, delta: 1 | -1) => {
    if (!match || !matchId) return null;
    if (match.status === 'completed' && delta === 1) return match;

    const newP1 = player === 1 ? Math.max(0, match.player1Score + delta) : match.player1Score;
    const newP2 = player === 2 ? Math.max(0, match.player2Score + delta) : match.player2Score;
    const firstServer = match.firstServer as 1 | 2;
    const server = calculateServer(newP1, newP2, match.targetScore, firstServer);
    const winner = checkWinner(newP1, newP2, match.targetScore);

    const update: any = {
      player1_score: newP1,
      player2_score: newP2,
      server,
    };

    if (winner) {
      update.status = 'completed';
      update.winner_id = winner === 1 ? match.player1Id : match.player2Id;
      update.completed_at = new Date().toISOString();
    }

    // Optimistic local update
    const newState: RealtimeMatchState = {
      ...match,
      player1Score: newP1,
      player2Score: newP2,
      server,
      status: winner ? 'completed' : match.status,
      winnerId: winner ? (winner === 1 ? match.player1Id : match.player2Id) : match.winnerId,
    };
    setMatch(newState);
    updatingRef.current = true;

    await supabase.from('matches').update(update).eq('id', matchId);

    return newState;
  }, [match, matchId]);

  return { match, loading, updateScore };
}
