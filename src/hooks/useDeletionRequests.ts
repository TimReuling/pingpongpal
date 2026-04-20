import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DeletionRequest {
  id: string;
  match_id: string;
  from_profile_id: string;
  to_profile_id: string;
  status: string;
  created_at: string;
  from_display_name: string;
  to_display_name: string;
  player1_name: string;
  player2_name: string;
  player1_score: number;
  player2_score: number;
  match_completed_at: string | null;
}

export type DeletionResult = 'direct' | 'requested' | 'error';

export function useDeletionRequests(profileId: string | undefined) {
  const [incoming, setIncoming] = useState<DeletionRequest[]>([]);
  const [outgoing, setOutgoing] = useState<DeletionRequest[]>([]);

  const fetchRequests = useCallback(async () => {
    if (!profileId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('deletion_requests')
      .select(`
        id, match_id, from_profile_id, to_profile_id, status, created_at,
        from_profile:profiles!deletion_requests_from_profile_id_fkey(display_name),
        to_profile:profiles!deletion_requests_to_profile_id_fkey(display_name),
        match:matches!deletion_requests_match_id_fkey(
          player1_score, player2_score, completed_at,
          player1:profiles!matches_player1_id_fkey(display_name),
          player2:profiles!matches_player2_id_fkey(display_name)
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const enriched: DeletionRequest[] = (data ?? []).map((r: any) => ({
      id: r.id,
      match_id: r.match_id,
      from_profile_id: r.from_profile_id,
      to_profile_id: r.to_profile_id,
      status: r.status,
      created_at: r.created_at,
      from_display_name: r.from_profile?.display_name ?? 'Unknown',
      to_display_name: r.to_profile?.display_name ?? 'Unknown',
      player1_name: r.match?.player1?.display_name ?? 'Unknown',
      player2_name: r.match?.player2?.display_name ?? 'Unknown',
      player1_score: r.match?.player1_score ?? 0,
      player2_score: r.match?.player2_score ?? 0,
      match_completed_at: r.match?.completed_at ?? null,
    }));

    setIncoming(enriched.filter(r => r.to_profile_id === profileId));
    setOutgoing(enriched.filter(r => r.from_profile_id === profileId));
  }, [profileId]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel('deletion-requests-watch')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'deletion_requests' }, () => {
        void fetchRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profileId, fetchRequests]);

  const requestDeletion = useCallback(async (matchId: string): Promise<DeletionResult> => {
    if (!profileId) return 'error';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('request_match_deletion', {
      p_match_id: matchId,
      p_requesting_profile_id: profileId,
    });

    if (error) {
      console.error('Failed to request deletion', error);
      return 'error';
    }

    // NULL → direct deletion (same auth user); UUID → request created
    return data === null ? 'direct' : 'requested';
  }, [profileId]);

  const respondToRequest = useCallback(async (requestId: string, accept: boolean, matchId: string): Promise<boolean> => {
    if (!accept) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deletion_requests')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', requestId);
      return false;
    }

    // Mark accepted first so the request disappears from the list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('deletion_requests')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('status', 'pending');

    if (updateError) {
      throw new Error(`Status update failed: ${updateError.message ?? updateError.code ?? JSON.stringify(updateError)}`);
    }

    // Remove match_requests rows first (FK constraint blocks match deletion)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('match_requests').delete().eq('match_id', matchId);

    // Delete match and recalculate stats for both players
    const { error: deleteError } = await supabase.rpc('delete_match_and_recalculate', {
      p_match_id: matchId,
    });

    if (deleteError) {
      // Revert acceptance so the request stays visible
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('deletion_requests')
        .update({ status: 'pending', responded_at: null })
        .eq('id', requestId);
      throw new Error(`Delete failed: ${deleteError.message ?? deleteError.code ?? JSON.stringify(deleteError)}`);
    }

    return true;
  }, []);

  const cancelRequest = useCallback(async (requestId: string): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('deletion_requests')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('id', requestId);
  }, []);

  return {
    incoming,
    outgoing,
    pendingCount: incoming.length + outgoing.length,
    requestDeletion,
    respondToRequest,
    cancelRequest,
    refetch: fetchRequests,
  };
}
