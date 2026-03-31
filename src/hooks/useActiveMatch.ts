import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { hasValidSessionPlayers, isActiveSession } from '@/lib/matchSession';

export interface ActiveMatchSummary {
  id: string;
  playerOneId: string;
  playerTwoId: string;
  status: string;
  completedAt: string | null;
}

function normalizeActiveMatch(data: {
  id: string;
  player1_id: string;
  player2_id: string;
  status: string;
  completed_at: string | null;
} | null): ActiveMatchSummary | null {
  if (!data) return null;

  if (
    !hasValidSessionPlayers({ player1Id: data.player1_id, player2Id: data.player2_id }) ||
    !isActiveSession({ status: data.status, completedAt: data.completed_at })
  ) {
    return null;
  }

  return {
    id: data.id,
    playerOneId: data.player1_id,
    playerTwoId: data.player2_id,
    status: data.status,
    completedAt: data.completed_at,
  };
}

export function useActiveMatch(profileId: string | undefined) {
  const [activeMatch, setActiveMatch] = useState<ActiveMatchSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const clearActiveMatch = useCallback(() => {
    setActiveMatch(null);
  }, []);

  const checkActiveMatch = useCallback(async () => {
    if (!profileId) {
      clearActiveMatch();
      setLoading(false);
      return;
    }

    await supabase.rpc('cleanup_stale_match_sessions', { p_profile_id: profileId });

    // Only restore matches updated within the last 2 hours to avoid stale sessions
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('matches')
      .select('id, player1_id, player2_id, status, completed_at')
      .eq('status', 'active')
      .is('completed_at', null)
      .is('winner_id', null)
      .gte('updated_at', twoHoursAgo)
      .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setActiveMatch(normalizeActiveMatch(data ?? null));
    setLoading(false);
  }, [clearActiveMatch, profileId]);

  useEffect(() => {
    void checkActiveMatch();
  }, [checkActiveMatch]);

  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel(`active-match-watch-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        (payload) => {
          const nextRow = (payload.new ?? null) as {
            player1_id?: string;
            player2_id?: string;
          } | null;
          const previousRow = (payload.old ?? null) as {
            player1_id?: string;
            player2_id?: string;
          } | null;

          const affectsCurrentProfile = [
            nextRow?.player1_id,
            nextRow?.player2_id,
            previousRow?.player1_id,
            previousRow?.player2_id,
          ].includes(profileId);

          if (affectsCurrentProfile) {
            void checkActiveMatch();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkActiveMatch, profileId]);

  return {
    activeMatch,
    activeMatchId: activeMatch?.id ?? null,
    loading,
    recheck: checkActiveMatch,
    clearActiveMatch,
  };
}
