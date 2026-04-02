import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MatchRequest {
  id: string;
  from_profile_id: string;
  to_profile_id: string;
  target_score: number;
  status: string;
  created_at: string;
  responded_at: string | null;
  match_id: string | null;
  from_name?: string;
  from_avatar?: string | null;
  to_name?: string;
  to_avatar?: string | null;
}

export function useMatchRequests(profileId: string | undefined) {
  const [incoming, setIncoming] = useState<MatchRequest[]>([]);
  const [outgoing, setOutgoing] = useState<MatchRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!profileId) return;

    // Only fetch challenges from the last 30 seconds (challenge expiration window)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const { data: inData } = await supabase
      .from('match_requests')
      .select('*')
      .eq('to_profile_id', profileId)
      .eq('status', 'pending')
      .gte('created_at', thirtySecondsAgo)
      .order('created_at', { ascending: false });

    // Keep challenge state separate from live match state.
    const { data: outData } = await supabase
      .from('match_requests')
      .select('*')
      .eq('from_profile_id', profileId)
      .eq('status', 'pending')
      .gte('created_at', thirtySecondsAgo)
      .order('created_at', { ascending: false });

    // Enrich with profile names
    const allProfileIds = new Set<string>();
    [...(inData || []), ...(outData || [])].forEach(r => {
      allProfileIds.add(r.from_profile_id);
      allProfileIds.add(r.to_profile_id);
    });

    let profileMap: Record<string, { display_name: string; avatar_url: string | null }> = {};
    if (allProfileIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', Array.from(allProfileIds));
      profiles?.forEach(p => {
        profileMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
      });
    }

    const enrich = (r: any): MatchRequest => ({
      ...r,
      from_name: profileMap[r.from_profile_id]?.display_name ?? 'Unknown',
      from_avatar: profileMap[r.from_profile_id]?.avatar_url ?? null,
      to_name: profileMap[r.to_profile_id]?.display_name ?? 'Unknown',
      to_avatar: profileMap[r.to_profile_id]?.avatar_url ?? null,
    });

    setIncoming((inData || []).map(enrich));
    setOutgoing((outData || []).map(enrich));
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Realtime subscription
  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel('match-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_requests',
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, fetchRequests]);

  const sendRequest = useCallback(async (toProfileId: string, targetScore: number) => {
    if (!profileId) return null;
    await supabase.rpc('cleanup_stale_match_sessions', { p_profile_id: profileId });

    // Cancel any existing pending requests to same opponent
    await supabase
      .from('match_requests')
      .delete()
      .eq('from_profile_id', profileId)
      .eq('to_profile_id', toProfileId)
      .eq('status', 'pending');

    const { data } = await supabase
      .from('match_requests')
      .insert({
        from_profile_id: profileId,
        to_profile_id: toProfileId,
        target_score: targetScore,
      })
      .select()
      .single();

    return data;
  }, [profileId]);

  const respondToRequest = useCallback(async (requestId: string, accept: boolean): Promise<string | null> => {
    if (!accept) {
      await supabase
        .from('match_requests')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      return null;
    }

    const { data, error } = await supabase.rpc('accept_match_request', {
      p_request_id: requestId,
    });

    if (error) {
      console.error('Failed to accept match request', error);
      return null;
    }

    return data ?? null;
  }, []);

  return { incoming, outgoing, loading, sendRequest, respondToRequest, refetch: fetchRequests };
}
