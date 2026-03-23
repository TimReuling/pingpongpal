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

  const checkActiveMatch = useCallback(async () => {
    if (!profileId) { setLoading(false); return; }

    const { data } = await supabase
      .from('matches')
      .select('id, player1_id, player2_id')
      .eq('status', 'in_progress')
      .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setActiveMatchId(data.id);
      setActiveOpponentId(data.player1_id === profileId ? data.player2_id : data.player1_id);
    } else {
      setActiveMatchId(null);
      setActiveOpponentId(null);
    }
    setLoading(false);
  }, [profileId]);

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
            if (d.status === 'in_progress') {
              setActiveMatchId(d.id);
              setActiveOpponentId(d.player1_id === profileId ? d.player2_id : d.player1_id);
            } else if (d.status === 'completed') {
              // Only clear if this was our active match
              if (d.id === activeMatchId) {
                setActiveMatchId(null);
                setActiveOpponentId(null);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, checkActiveMatch, activeMatchId]);

  return { activeMatchId, activeOpponentId, loading: loading, recheck: checkActiveMatch };
}
