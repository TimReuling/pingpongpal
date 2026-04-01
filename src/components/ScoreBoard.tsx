import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeMatch } from '@/hooks/useRealtimeMatch';
import { playScoreDown, playScoreUp, playServiceChange, playWin } from '@/lib/sounds';
import { t, type Lang } from '@/lib/i18n';
import MatchStatusBar from './live-match/MatchStatusBar';
import PlayerScorePanel from './live-match/PlayerScorePanel';
import EndMatchRequest from './live-match/EndMatchRequest';
import RematchPopup from './live-match/RematchPopup';

interface ScoreBoardProps {
  matchId: string;
  currentProfileId: string;
  lang: Lang;
  soundEnabled: boolean;
  onExit: () => void;
  onRematch?: (playerOneId: string, playerTwoId: string, targetScore: number) => void;
}

const END_REQUEST_TIMEOUT_MS = 10_000;

export default function ScoreBoard({ matchId, currentProfileId, lang, soundEnabled, onExit, onRematch }: ScoreBoardProps) {
  const { match, players, loading, updateScore, cancelMatch } = useRealtimeMatch(matchId, currentProfileId);
  const [prevScores, setPrevScores] = useState<{ playerOneScore: number; playerTwoScore: number } | null>(null);
  const [winnerAcknowledged, setWinnerAcknowledged] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);

  // End-match request state
  const [endMatchRequested, setEndMatchRequested] = useState(false);
  const [endMatchIncoming, setEndMatchIncoming] = useState<string | null>(null);
  const endMatchRequestedRef = useRef(false);
  const endRequestTimeoutRef = useRef<number | null>(null);

  // Rematch state
  const [rematchRequested, setRematchRequested] = useState(false);
  const [rematchIncoming, setRematchIncoming] = useState(false);

  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const handleConfirmedEndRef = useRef<() => Promise<void>>();

  const winnerName = useMemo(() => {
    if (!match?.winnerId) return null;
    if (match.winnerId === players.playerOne?.id) return players.playerOne.display_name;
    if (match.winnerId === players.playerTwo?.id) return players.playerTwo.display_name;
    return null;
  }, [match?.winnerId, players.playerOne, players.playerTwo]);

  // Confirmed end handler
  const handleConfirmedEnd = useCallback(async () => {
    setEndMatchRequested(false);
    endMatchRequestedRef.current = false;
    setEndMatchIncoming(null);
    if (endRequestTimeoutRef.current) {
      window.clearTimeout(endRequestTimeoutRef.current);
      endRequestTimeoutRef.current = null;
    }
    await cancelMatch();
    onExit();
  }, [cancelMatch, onExit]);

  // Keep ref in sync
  useEffect(() => {
    handleConfirmedEndRef.current = handleConfirmedEnd;
  }, [handleConfirmedEnd]);

  // Force leave (abandon)
  const handleForceLeave = useCallback(async () => {
    setEndMatchRequested(false);
    endMatchRequestedRef.current = false;
    setEndMatchIncoming(null);
    if (endRequestTimeoutRef.current) {
      window.clearTimeout(endRequestTimeoutRef.current);
      endRequestTimeoutRef.current = null;
    }
    await cancelMatch();
    onExit();
  }, [cancelMatch, onExit]);

  // Set up broadcast channel
  useEffect(() => {
    if (!matchId) return;

    const channel = supabase.channel(`match-signals-${matchId}`);
    broadcastChannelRef.current = channel;

    channel.on('broadcast', { event: 'end-match-request' }, (payload) => {
      const senderId = payload.payload?.senderId;
      const senderName = payload.payload?.senderName;
      if (senderId && senderId !== currentProfileId) {
        // If we also requested end, both want out — auto cancel immediately
        if (endMatchRequestedRef.current) {
          void handleConfirmedEndRef.current?.();
        } else {
          setEndMatchIncoming(senderName || 'Opponent');
        }
      }
    });

    channel.on('broadcast', { event: 'end-match-decline' }, (payload) => {
      const senderId = payload.payload?.senderId;
      if (senderId && senderId !== currentProfileId) {
        setEndMatchRequested(false);
        endMatchRequestedRef.current = false;
        if (endRequestTimeoutRef.current) {
          window.clearTimeout(endRequestTimeoutRef.current);
          endRequestTimeoutRef.current = null;
        }
      }
    });

    channel.on('broadcast', { event: 'end-match-accept' }, (payload) => {
      const senderId = payload.payload?.senderId;
      if (senderId && senderId !== currentProfileId) {
        void handleConfirmedEndRef.current?.();
      }
    });

    channel.on('broadcast', { event: 'rematch-request' }, (payload) => {
      const senderId = payload.payload?.senderId;
      if (senderId && senderId !== currentProfileId) {
        setRematchIncoming(true);
      }
    });

    channel.on('broadcast', { event: 'rematch-accept' }, (payload) => {
      const senderId = payload.payload?.senderId;
      const newMatchId = payload.payload?.newMatchId;
      if (senderId && senderId !== currentProfileId && newMatchId) {
        onRematch?.(
          payload.payload.playerOneId,
          payload.payload.playerTwoId,
          payload.payload.targetScore
        );
      }
    });

    channel.on('broadcast', { event: 'rematch-decline' }, (payload) => {
      const senderId = payload.payload?.senderId;
      if (senderId && senderId !== currentProfileId) {
        setRematchRequested(false);
        toast.info('Opponent declined rematch');
        setTimeout(onExit, 1500);
      }
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
      broadcastChannelRef.current = null;
    };
  }, [matchId, currentProfileId]);

  // Sound effects
  useEffect(() => {
    if (!match || !soundEnabled) return;

    if (!prevScores) {
      setPrevScores({
        playerOneScore: match.playerOneScore,
        playerTwoScore: match.playerTwoScore,
      });
      return;
    }

    const playerOneDiff = match.playerOneScore - prevScores.playerOneScore;
    const playerTwoDiff = match.playerTwoScore - prevScores.playerTwoScore;

    if (playerOneDiff > 0 || playerTwoDiff > 0) {
      playScoreUp();
    } else if (playerOneDiff < 0 || playerTwoDiff < 0) {
      playScoreDown();
    }

    setPrevScores({
      playerOneScore: match.playerOneScore,
      playerTwoScore: match.playerTwoScore,
    });
  }, [match, prevScores, soundEnabled]);

  // Win detection with confetti
  useEffect(() => {
    if (!match) return;

    if (match.status === 'finished' && match.winnerId && !winnerAcknowledged) {
      setWinnerAcknowledged(true);
      setShowWinModal(true);

      if (soundEnabled) playWin();

      const duration = 2500;
      const end = Date.now() + duration;
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: ['#22c55e', '#facc15', '#f97316'] });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: ['#22c55e', '#facc15', '#f97316'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }

    if ((match.status === 'cancelled' || match.status === 'abandoned') && !winnerAcknowledged) {
      setWinnerAcknowledged(true);
      toast.info(t('opponentLeft', lang));
      const timer = window.setTimeout(() => onExit(), 1500);
      return () => window.clearTimeout(timer);
    }
  }, [lang, match, onExit, soundEnabled, winnerAcknowledged]);

  // Request end match — starts 10s timeout, after which we force cancel
  const handleEndMatchRequest = useCallback(() => {
    if (endMatchRequestedRef.current) {
      // Already requested — pressing again force-leaves
      void handleForceLeave();
      return;
    }

    setEndMatchRequested(true);
    endMatchRequestedRef.current = true;

    const myName = match?.playerOneId === currentProfileId
      ? players.playerOne?.display_name
      : players.playerTwo?.display_name;

    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'end-match-request',
      payload: { senderId: currentProfileId, senderName: myName ?? 'Player' },
    });

    // Auto-cancel after 10 seconds if no response
    endRequestTimeoutRef.current = window.setTimeout(() => {
      void handleConfirmedEndRef.current?.();
    }, END_REQUEST_TIMEOUT_MS);
  }, [currentProfileId, handleForceLeave, match, players]);

  const handleAcceptEnd = useCallback(() => {
    setEndMatchIncoming(null);
    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'end-match-accept',
      payload: { senderId: currentProfileId },
    });
    void handleConfirmedEnd();
  }, [currentProfileId, handleConfirmedEnd]);

  const handleDeclineEnd = useCallback(() => {
    setEndMatchIncoming(null);
    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'end-match-decline',
      payload: { senderId: currentProfileId },
    });
  }, [currentProfileId]);

  const handleRematchRequest = useCallback(async () => {
    if (rematchIncoming && match && onRematch) {
      const { data } = await supabase
        .from('matches')
        .insert({
          player1_id: match.playerOneId,
          player2_id: match.playerTwoId,
          target_score: match.targetScore,
          status: 'active',
        })
        .select('id')
        .single();

      if (data) {
        broadcastChannelRef.current?.send({
          type: 'broadcast',
          event: 'rematch-accept',
          payload: {
            senderId: currentProfileId,
            newMatchId: data.id,
            playerOneId: match.playerOneId,
            playerTwoId: match.playerTwoId,
            targetScore: match.targetScore,
          },
        });
        onRematch(match.playerOneId, match.playerTwoId, match.targetScore);
      }
    } else {
      setRematchRequested(true);
      broadcastChannelRef.current?.send({
        type: 'broadcast',
        event: 'rematch-request',
        payload: { senderId: currentProfileId },
      });
    }
  }, [currentProfileId, match, onRematch, rematchIncoming]);

  const handleDeclineRematch = useCallback(() => {
    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'rematch-decline',
      payload: { senderId: currentProfileId },
    });
    onExit();
  }, [currentProfileId, onExit]);

  const handleScore = useCallback(async (side: 'playerOne' | 'playerTwo', delta: 1 | -1) => {
    if (!match || match.status !== 'active') return;

    const previousServer = match.server;
    const nextState = await updateScore(side, delta);

    if (nextState && soundEnabled && nextState.server !== previousServer && nextState.status === 'active') {
      window.setTimeout(() => playServiceChange(), 100);
    }
  }, [match, soundEnabled, updateScore]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (endRequestTimeoutRef.current) {
        window.clearTimeout(endRequestTimeoutRef.current);
      }
    };
  }, []);

  if (loading || !match || !players.playerOne || !players.playerTwo) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6">
        <div className="rounded-3xl border border-border bg-card px-6 py-5 text-center shadow-sm">
          <div className="text-lg font-bold text-foreground">{t('sharedMatch', lang)}</div>
          <div className="mt-1 text-sm text-muted-foreground">Syncing live session…</div>
        </div>
      </div>
    );
  }

  const isInteractive = match.status === 'active';

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <MatchStatusBar
        lang={lang}
        targetScore={match.targetScore}
        status={match.status}
        isInteractive={isInteractive}
        endMatchPending={endMatchRequested}
        onEndMatchRequest={handleEndMatchRequest}
        onForceLeave={handleForceLeave}
      />

      <main className="flex flex-1 flex-col gap-3 p-3 md:p-4">
        <div className="grid flex-1 gap-3 md:grid-cols-2">
          <PlayerScorePanel
            player={players.playerOne}
            score={match.playerOneScore}
            side="playerOne"
            isServing={match.server === 1}
            isInteractive={isInteractive}
            lang={lang}
            onPlus={() => handleScore('playerOne', 1)}
            onMinus={() => handleScore('playerOne', -1)}
          />

          <PlayerScorePanel
            player={players.playerTwo}
            score={match.playerTwoScore}
            side="playerTwo"
            isServing={match.server === 2}
            isInteractive={isInteractive}
            lang={lang}
            onPlus={() => handleScore('playerTwo', 1)}
            onMinus={() => handleScore('playerTwo', -1)}
          />
        </div>

        <div className="safe-bottom rounded-[1.75rem] border border-border bg-card px-4 py-3 text-center shadow-sm">
          <p className="text-sm font-semibold text-foreground">
            {winnerName && match.status === 'finished'
              ? `🏆 ${winnerName} ${t('won', lang)}`
              : isInteractive
                ? `${t('firstTo', lang)} ${match.targetScore} · ${t('service', lang)} ${match.server === 1 ? players.playerOne.display_name : players.playerTwo.display_name}`
                : t('returningToLobby', lang)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {match.playerOneScore} - {match.playerTwoScore}
          </p>
        </div>
      </main>

      {/* End match request popup (shown to the OTHER player) */}
      {endMatchIncoming && (
        <EndMatchRequest
          requesterName={endMatchIncoming}
          lang={lang}
          onAccept={handleAcceptEnd}
          onTimeout={handleAcceptEnd}
        />
      )}

      {/* Win modal with rematch */}
      {showWinModal && winnerName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-6">
          <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl bg-card p-8 shadow-2xl animate-in zoom-in-95">
            <div className="text-6xl">🏆</div>
            <h2 className="text-3xl font-black text-card-foreground">{winnerName}</h2>
            <p className="text-xl font-bold text-primary">{t('winner', lang)}</p>
            <p className="score-font text-2xl font-bold text-muted-foreground">
              {match.playerOneScore} - {match.playerTwoScore}
            </p>

            {onRematch ? (
              <RematchPopup
                lang={lang}
                waitingForOpponent={rematchRequested && !rematchIncoming}
                onRematch={handleRematchRequest}
                onExit={handleDeclineRematch}
              />
            ) : (
              <button
                onClick={onExit}
                className="w-full rounded-2xl bg-muted py-3 font-semibold text-muted-foreground transition-all active:scale-95"
              >
                {t('newMatch', lang)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
