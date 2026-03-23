import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Checks for an active (in_progress) match for the current profile
 * and provides a way to resume it.
 */
export function useActiveMatch(profileId: string | undefined) {
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [activeOpponentId, setActiveOpponentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearActiveMatch = useCallback(() => {
    setActiveMatchId(null);
    setActiveOpponentId(null);
  }, []);

  const checkActiveMatch = useCallback(async () => {
    if (!profileId) { setLoading(false); return; }

    await supabase.rpc('cleanup_stale_match_sessions', { p_profile_id: profileId });

    const { data } = await supabase
      .from('matches')
      .select('id, player1_id, player2_id, status, completed_at')
      .eq('status', 'active')
      .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data && data.status === 'active' && !data.completed_at) {
      setActiveMatchId(data.id);
      setActiveOpponentId(data.player1_id === profileId ? data.player2_id : data.player1_id);
    } else {
      clearActiveMatch();
    }
    setLoading(false);
  }, [profileId, clearActiveMatch]);

  useEffect(() => {
    checkActiveMatch();
  }, [checkActiveMatch]);

  // Listen for new matches involving this profile
  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel('active-match-watch')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        (payload) => {
          const d = payload.new as any;
          if (!d) { checkActiveMatch(); return; }
          if (d.player1_id === profileId || d.player2_id === profileId) {
            if (d.status === 'active' && !d.completed_at) {
              setActiveMatchId(d.id);
              setActiveOpponentId(d.player1_id === profileId ? d.player2_id : d.player1_id);
            } else if (['finished', 'declined', 'abandoned', 'cancelled', 'completed'].includes(d.status)) {
              if (d.id === activeMatchId) {
                clearActiveMatch();
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, checkActiveMatch, activeMatchId, clearActiveMatch]);

  return { activeMatchId, activeOpponentId, loading: loading, recheck: checkActiveMatch, clearActiveMatch };
}
