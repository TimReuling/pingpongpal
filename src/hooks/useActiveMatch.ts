import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { canRestoreSession, debugMatchEvent, normalizeSessionStatus } from '@/lib/matchSession';

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
  player1_score: number;
  player2_score: number;
  status: string;
  completed_at: string | null;
  winner_id: string | null;
} | null): ActiveMatchSummary | null {
  if (!data) return null;

  if (!canRestoreSession({
    player1Id: data.player1_id,
    player2Id: data.player2_id,
    status: data.status,
    completedAt: data.completed_at,
    winnerId: data.winner_id,
    player1Score: data.player1_score,
    player2Score: data.player2_score,
  })) {
    debugMatchEvent('restore rejected for non-restorable session', data);
    return null;
  }

  return {
    id: data.id,
    playerOneId: data.player1_id,
    playerTwoId: data.player2_id,
    status: normalizeSessionStatus(data.status) ?? data.status,
    completedAt: data.completed_at,
  };
}

export function useActiveMatch(profileId: string | undefined) {
  const [activeMatch, setActiveMatch] = useState<ActiveMatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // Ref mirrors activeMatch.id so the realtime subscription can read it without
  // capturing a stale closure over the state value.
  const activeMatchIdRef = useRef<string | null>(null);

  const clearActiveMatch = useCallback(() => {
    activeMatchIdRef.current = null;
    setActiveMatch(null);
  }, []);

  const checkActiveMatch = useCallback(async () => {
    if (!profileId) {
      debugMatchEvent('restore skipped without profile', null);
      clearActiveMatch();
      setLoading(false);
      return;
    }

    try {
      debugMatchEvent('restore check started', { profileId });
      await supabase.rpc('cleanup_stale_match_sessions', { p_profile_id: profileId });

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('matches')
        .select('id, player1_id, player2_id, player1_score, player2_score, status, completed_at, winner_id')
        .eq('status', 'active')
        .is('completed_at', null)
        .is('winner_id', null)
        .gte('updated_at', twoHoursAgo)
        .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Failed to restore active match session', error);
        clearActiveMatch();
        return;
      }

      const nextActiveMatch = normalizeActiveMatch(data ?? null);
      debugMatchEvent('restore check resolved', {
        profileId,
        restoredMatchId: nextActiveMatch?.id ?? null,
        restoredStatus: nextActiveMatch?.status ?? null,
      });
      activeMatchIdRef.current = nextActiveMatch?.id ?? null;
      setActiveMatch(nextActiveMatch);
    } catch (error) {
      console.error('Unexpected error while checking active match session', error);
      clearActiveMatch();
    } finally {
      setLoading(false);
    }
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
            const incomingId = (nextRow as any)?.id as string | undefined;
            const incomingStatus = (nextRow as any)?.status as string | undefined;

            // When the match we're currently tracking explicitly transitions to a
            // non-active status, clear immediately rather than doing a DB round-trip.
            // This eliminates the read-after-write race where checkActiveMatch() could
            // briefly still see the row as active and re-route the user back.
            if (
              incomingId &&
              incomingId === activeMatchIdRef.current &&
              incomingStatus &&
              incomingStatus !== 'active'
            ) {
              debugMatchEvent('restore cleared by direct status observation', {
                profileId,
                matchId: incomingId,
                incomingStatus,
              });
              clearActiveMatch();
            } else {
              debugMatchEvent('restore recheck triggered by realtime sync', {
                profileId,
                eventType: payload.eventType,
              });
              void checkActiveMatch();
            }
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
