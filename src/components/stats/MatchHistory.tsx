import { useState } from 'react';
import { toast } from 'sonner';
import { type MatchRecord, type PlayerProfile } from '@/hooks/useStatsData';
import { type DeletionResult } from '@/hooks/useDeletionRequests';
import { Trash2, Clock, Bell } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  matches: MatchRecord[];
  profiles: PlayerProfile[];
  currentProfileId: string;
  outgoingMatchIds: Set<string>;
  incomingMatchIds: Set<string>;
  onRequestDeletion: (matchId: string) => Promise<DeletionResult>;
  onDeletePlayerMatches: (profileId: string) => Promise<void>;
  onResetAll: () => Promise<void>;
  onOpenPendingDeletions: () => void;
}

export default function MatchHistory({
  matches, profiles, currentProfileId,
  outgoingMatchIds, incomingMatchIds,
  onRequestDeletion, onDeletePlayerMatches, onResetAll,
  onOpenPendingDeletions,
}: Props) {
  const [confirmAction, setConfirmAction] = useState<{
    type: 'match' | 'player' | 'all';
    id?: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterPlayer, setFilterPlayer] = useState<string>('');

  const filtered = filterPlayer
    ? matches.filter(m => m.player1_id === filterPlayer || m.player2_id === filterPlayer)
    : matches;

  const reversed = [...filtered].reverse();

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setDeleting(true);
    try {
      if (confirmAction.type === 'match' && confirmAction.id) {
        const result = await onRequestDeletion(confirmAction.id);
        if (result === 'error') throw new Error('rpc_failed');
        if (result === 'direct') toast.success('Match deleted — stats updated');
        else toast.success('Deletion request sent — waiting for the other player\'s approval');
      } else if (confirmAction.type === 'player' && confirmAction.id) {
        await onDeletePlayerMatches(confirmAction.id);
      } else if (confirmAction.type === 'all') {
        await onResetAll();
      }
    } catch {
      toast.error('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
      setConfirmAction(null);
    }
  };

  const activePlayers = profiles.filter(p =>
    matches.some(m => m.player1_id === p.id || m.player2_id === p.id)
  );

  const pendingCount = incomingMatchIds.size + outgoingMatchIds.size;

  return (
    <div className="flex flex-col gap-3">
      {/* Pending deletions banner */}
      {pendingCount > 0 && (
        <button
          onClick={onOpenPendingDeletions}
          className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-left active:scale-95"
        >
          <Bell className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="flex-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
            {incomingMatchIds.size > 0
              ? `${incomingMatchIds.size} deletion request${incomingMatchIds.size > 1 ? 's' : ''} awaiting your approval`
              : `${outgoingMatchIds.size} deletion request${outgoingMatchIds.size > 1 ? 's' : ''} pending`}
          </span>
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">View →</span>
        </button>
      )}

      {/* Filter + bulk actions */}
      <div className="flex items-center gap-2">
        <select
          value={filterPlayer}
          onChange={e => setFilterPlayer(e.target.value)}
          className="flex-1 rounded-xl bg-muted px-3 py-2 text-sm text-foreground"
        >
          <option value="">All players</option>
          {activePlayers.map(p => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </select>
        {filterPlayer && (
          <button
            onClick={() => setConfirmAction({
              type: 'player',
              id: filterPlayer,
              label: `Delete ALL matches for ${activePlayers.find(p => p.id === filterPlayer)?.display_name ?? 'this player'}? Stats will be recalculated.`,
            })}
            className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive active:scale-95"
          >
            Delete All
          </button>
        )}
      </div>

      {/* Reset all button */}
      <button
        onClick={() => setConfirmAction({
          type: 'all',
          label: 'Delete ALL matches and reset ALL statistics for every player? This cannot be undone.',
        })}
        className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-xs font-semibold text-destructive active:scale-95"
      >
        Reset All Statistics
      </button>

      {/* Match list */}
      {reversed.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No matches found</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {reversed.map(m => {
            const isPendingOutgoing = outgoingMatchIds.has(m.id);
            const isPendingIncoming = incomingMatchIds.has(m.id);
            const otherName = m.player1_id === currentProfileId ? m.player2_name : m.player1_name;

            return (
              <div key={m.id} className="flex items-center gap-2 rounded-xl bg-card p-3 shadow-sm">
                <div className="flex-1 text-right">
                  <p className={`text-sm font-semibold ${m.winner_id === m.player1_id ? 'text-primary' : 'text-card-foreground'}`}>
                    {m.player1_name}
                  </p>
                </div>
                <div className="score-font text-sm font-bold text-foreground">
                  {m.player1_score} - {m.player2_score}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${m.winner_id === m.player2_id ? 'text-primary' : 'text-card-foreground'}`}>
                    {m.player2_name}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {m.completed_at ? new Date(m.completed_at).toLocaleDateString() : ''}
                </span>

                {isPendingIncoming ? (
                  <button
                    onClick={onOpenPendingDeletions}
                    title="Deletion approval needed"
                    className="rounded-lg p-1.5 text-amber-500"
                  >
                    <Bell className="h-3.5 w-3.5" />
                  </button>
                ) : isPendingOutgoing ? (
                  <span title="Waiting for other player's approval" className="rounded-lg p-1.5 text-muted-foreground/50">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmAction({
                      type: 'match',
                      id: m.id,
                      label: `Request deletion of this match with ${otherName}? They will need to approve before it is removed.`,
                    })}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Processing…' : confirmAction?.type === 'match' ? 'Send Request' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
