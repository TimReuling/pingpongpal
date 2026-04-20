import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useDeletionRequests, type DeletionRequest } from '@/hooks/useDeletionRequests';
import { type Lang } from '@/lib/i18n';

interface Props {
  currentProfileId: string;
  lang: Lang;
  onBack: () => void;
}

export default function PendingDeletionsPage({ currentProfileId, onBack }: Props) {
  const { incoming, outgoing, respondToRequest, cancelRequest } = useDeletionRequests(currentProfileId);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const setWorking = (id: string, on: boolean) =>
    setProcessing(prev => { const s = new Set(prev); on ? s.add(id) : s.delete(id); return s; });

  const handleRespond = async (requestId: string, accept: boolean) => {
    setWorking(requestId, true);
    try {
      const ok = await respondToRequest(requestId, accept);
      if (ok) toast.success('Match deleted — stats updated for both players');
      else if (!accept) toast.success('Deletion request declined');
      else toast.error('Failed to process request. Please try again.');
    } finally {
      setWorking(requestId, false);
    }
  };

  const handleCancel = async (requestId: string) => {
    setWorking(requestId, true);
    try {
      await cancelRequest(requestId);
      toast.success('Deletion request cancelled');
    } finally {
      setWorking(requestId, false);
    }
  };

  const isEmpty = incoming.length === 0 && outgoing.length === 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="safe-top flex items-center gap-3 bg-table-green-dark px-4 py-5">
        <button
          onClick={onBack}
          className="rounded-xl bg-primary-foreground/10 px-3 py-2 text-primary-foreground font-semibold active:scale-95"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-primary-foreground">Pending Deletions</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-lg flex flex-col gap-6">
          {isEmpty && (
            <div className="py-16 text-center">
              <Trash2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-semibold text-foreground">No pending requests</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Deletion requests from matches you played will appear here.
              </p>
            </div>
          )}

          {incoming.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Awaiting Your Approval ({incoming.length})
              </h2>
              {incoming.map(req => (
                <RequestCard
                  key={req.id}
                  req={req}
                  mode="incoming"
                  busy={processing.has(req.id)}
                  onAccept={() => handleRespond(req.id, true)}
                  onDecline={() => handleRespond(req.id, false)}
                />
              ))}
            </section>
          )}

          {outgoing.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Sent — Waiting for Approval ({outgoing.length})
              </h2>
              {outgoing.map(req => (
                <RequestCard
                  key={req.id}
                  req={req}
                  mode="outgoing"
                  busy={processing.has(req.id)}
                  onCancel={() => handleCancel(req.id)}
                />
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestCard({
  req, mode, busy, onAccept, onDecline, onCancel,
}: {
  req: DeletionRequest;
  mode: 'incoming' | 'outgoing';
  busy: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}) {
  const date = req.match_completed_at
    ? new Date(req.match_completed_at).toLocaleDateString()
    : null;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm flex flex-col gap-3 border border-border/50">
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {mode === 'incoming' ? (
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{req.from_display_name}</span> wants to delete this match
          </span>
        ) : (
          <span className="text-muted-foreground">
            Waiting for <span className="font-semibold text-foreground">{req.to_display_name}</span> to approve
          </span>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-2.5">
        <span className="text-sm font-semibold text-foreground">{req.player1_name}</span>
        <span className="score-font text-sm font-bold text-foreground tabular-nums">
          {req.player1_score} – {req.player2_score}
        </span>
        <span className="text-sm font-semibold text-foreground">{req.player2_name}</span>
      </div>

      {date && (
        <p className="text-xs text-center text-muted-foreground">{date}</p>
      )}

      {mode === 'incoming' && onAccept && onDecline && (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground active:scale-95 disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            {busy ? 'Processing…' : 'Approve & Delete'}
          </button>
          <button
            onClick={onDecline}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-muted py-2.5 text-sm font-semibold text-muted-foreground active:scale-95 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            Decline
          </button>
        </div>
      )}

      {mode === 'outgoing' && onCancel && (
        <button
          onClick={onCancel}
          disabled={busy}
          className="w-full rounded-xl bg-muted py-2.5 text-sm font-semibold text-muted-foreground active:scale-95 disabled:opacity-50"
        >
          {busy ? 'Cancelling…' : 'Cancel Request'}
        </button>
      )}
    </div>
  );
}
