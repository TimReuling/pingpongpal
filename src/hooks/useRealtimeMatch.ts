import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { hasValidSessionPlayers, resolveSessionPlayers } from '@/lib/matchSession';

const FINALIZE_RPC_URL = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/finalize_match_session`;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface RealtimeMatchState {
  matchId: string;
  playerOneId: string;
  playerTwoId: string;
  playerOneScore: number;
  playerTwoScore: number;
  server: 1 | 2;
  firstServer: 1 | 2;
  targetScore: number;
  status: string;
  winnerId: string | null;
  completedAt: string | null;
}

interface MatchPlayers {
  playerOne: Tables<'profiles'> | null;
  playerTwo: Tables<'profiles'> | null;
}

function normalizeRealtimeState(data: any): RealtimeMatchState | null {
  if (!data || !hasValidSessionPlayers({ player1Id: data.player1_id, player2Id: data.player2_id })) {
    return null;
  }

  return {
    matchId: data.id,
    playerOneId: data.player1_id,
    playerTwoId: data.player2_id,
    playerOneScore: data.player1_score,
    playerTwoScore: data.player2_score,
    server: data.server,
    firstServer: data.first_server,
    targetScore: data.target_score,
    status: data.status,
    winnerId: data.winner_id,
    completedAt: data.completed_at,
  };
}

export function useRealtimeMatch(matchId: string | null, currentProfileId?: string) {
  const [match, setMatch] = useState<RealtimeMatchState | null>(null);
  const [players, setPlayers] = useState<MatchPlayers>({ playerOne: null, playerTwo: null });
  const [loading, setLoading] = useState(true);
  const matchRef = useRef<RealtimeMatchState | null>(null);
  const authTokenRef = useRef<string | null>(null);
  const loadedPlayersKeyRef = useRef<string | null>(null);

  const loadPlayers = useCallback(async (playerOneId: string, playerTwoId: string) => {
    const nextKey = `${playerOneId}:${playerTwoId}`;
    if (loadedPlayersKeyRef.current === nextKey) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('id', [playerOneId, playerTwoId]);

    const { playerOne, playerTwo } = resolveSessionPlayers(data ?? [], playerOneId, playerTwoId);
    loadedPlayersKeyRef.current = nextKey;
    setPlayers({ playerOne, playerTwo });
  }, []);

  const applyMatchRow = useCallback(async (row: any | null) => {
    const nextMatch = normalizeRealtimeState(row);
    setMatch(nextMatch);
    matchRef.current = nextMatch;

    if (!nextMatch) {
      loadedPlayersKeyRef.current = null;
      setPlayers({ playerOne: null, playerTwo: null });
      return;
    }

    await loadPlayers(nextMatch.playerOneId, nextMatch.playerTwoId);
  }, [loadPlayers]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      authTokenRef.current = data.session?.access_token ?? null;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authTokenRef.current = session?.access_token ?? null;
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!matchId) {
      setLoading(false);
      void applyMatchRow(null);
      return;
    }

    setLoading(true);

    const fetchMatch = async () => {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      await applyMatchRow(data ?? null);
      setLoading(false);
    };

    void fetchMatch();
  }, [applyMatchRow, matchId]);

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`shared-match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const nextRow = payload.eventType === 'DELETE' ? null : payload.new;
          void applyMatchRow(nextRow);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [applyMatchRow, matchId]);

  useEffect(() => {
    if (!matchId || !currentProfileId) return;

    const cancelOnPageHide = () => {
      const currentMatch = matchRef.current;

      if (!currentMatch || currentMatch.status !== 'active' || !authTokenRef.current) {
        return;
      }

      void fetch(FINALIZE_RPC_URL, {
        method: 'POST',
        keepalive: true,
        headers: {
          apikey: PUBLISHABLE_KEY,
          Authorization: `Bearer ${authTokenRef.current}`,
          'Content-Type': 'application/json',
          Prefer: 'params=single-object',
        },
        body: JSON.stringify({
          p_match_id: currentMatch.matchId,
          p_status: 'cancelled',
          p_closed_by_profile_id: currentProfileId,
        }),
      });
    };

    window.addEventListener('pagehide', cancelOnPageHide);
    return () => window.removeEventListener('pagehide', cancelOnPageHide);
  }, [currentProfileId, matchId]);

  const updateScore = useCallback(async (side: 'playerOne' | 'playerTwo', delta: 1 | -1) => {
    const currentMatch = matchRef.current;

    if (
      !matchId ||
      !currentMatch ||
      currentMatch.status !== 'active' ||
      !hasValidSessionPlayers({
        player1Id: currentMatch.playerOneId,
        player2Id: currentMatch.playerTwoId,
      })
    ) {
      console.error('Cannot update score without a valid active shared match session');
      return null;
    }

    const { data, error } = await supabase.rpc('update_match_score', {
      p_match_id: matchId,
      p_player: side === 'playerOne' ? 1 : 2,
      p_delta: delta,
    });

    if (error || !data) {
      console.error('Failed to update live match score', error);
      return null;
    }

    await applyMatchRow(data);
    return normalizeRealtimeState(data);
  }, [applyMatchRow, matchId]);

  const cancelMatch = useCallback(async () => {
    if (!matchId) return null;

    const { data, error } = await supabase.rpc('finalize_match_session', {
      p_match_id: matchId,
      p_status: 'cancelled',
      p_closed_by_profile_id: currentProfileId ?? null,
    });

    if (error) {
      console.error('Failed to cancel live match session', error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (row) {
      const { data: fullRow } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      await applyMatchRow(fullRow ?? null);
    }

    return row ?? null;
  }, [applyMatchRow, currentProfileId, matchId]);

  return { match, players, loading, updateScore, cancelMatch };
}
