import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRealtimeMatch } from '@/hooks/useRealtimeMatch';
import { playScoreDown, playScoreUp, playServiceChange, playWin } from '@/lib/sounds';
import { t, type Lang } from '@/lib/i18n';
import MatchStatusBar from './live-match/MatchStatusBar';
import PlayerScorePanel from './live-match/PlayerScorePanel';

interface ScoreBoardProps {
  matchId: string;
  currentProfileId: string;
  lang: Lang;
  soundEnabled: boolean;
  onExit: () => void;
}

export default function ScoreBoard({ matchId, currentProfileId, lang, soundEnabled, onExit }: ScoreBoardProps) {
  const { match, players, loading, updateScore, cancelMatch } = useRealtimeMatch(matchId, currentProfileId);
  const [prevScores, setPrevScores] = useState<{ playerOneScore: number; playerTwoScore: number } | null>(null);
  const [winnerAcknowledged, setWinnerAcknowledged] = useState(false);

  const winnerName = useMemo(() => {
    if (!match?.winnerId) return null;
    if (match.winnerId === players.playerOne?.id) return players.playerOne.display_name;
    if (match.winnerId === players.playerTwo?.id) return players.playerTwo.display_name;
    return null;
  }, [match?.winnerId, players.playerOne, players.playerTwo]);

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

    if (match.server !== (playerOneDiff !== 0 || playerTwoDiff !== 0 ? match.server : match.server)) {
      playServiceChange();
    }

    setPrevScores({
      playerOneScore: match.playerOneScore,
      playerTwoScore: match.playerTwoScore,
    });
  }, [match, prevScores, soundEnabled]);

  useEffect(() => {
    if (!match) return;

    if (match.status === 'finished' && match.winnerId && !winnerAcknowledged) {
      setWinnerAcknowledged(true);
      if (soundEnabled) playWin();
      toast.success(`${winnerName ?? t('winner', lang)} ${t('won', lang)}`);

      const timer = window.setTimeout(() => {
        onExit();
      }, 2500);

      return () => window.clearTimeout(timer);
    }

    if ((match.status === 'cancelled' || match.status === 'abandoned') && !winnerAcknowledged) {
      setWinnerAcknowledged(true);
      toast.info(t('opponentLeft', lang));
      const timer = window.setTimeout(() => {
        onExit();
      }, 1200);

      return () => window.clearTimeout(timer);
    }
  }, [lang, match, onExit, soundEnabled, winnerAcknowledged, winnerName]);

  const handleScore = useCallback(async (side: 'playerOne' | 'playerTwo', delta: 1 | -1) => {
    if (!match || match.status !== 'active') return;

    const previousServer = match.server;
    const nextState = await updateScore(side, delta);

    if (nextState && soundEnabled && nextState.server !== previousServer && nextState.status === 'active') {
      window.setTimeout(() => playServiceChange(), 100);
    }
  }, [match, soundEnabled, updateScore]);

  const handleLeave = useCallback(async () => {
    await cancelMatch();
    onExit();
  }, [cancelMatch, onExit]);

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
        onLeave={handleLeave}
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
              ? `${winnerName} ${t('won', lang)}`
              : isInteractive
                ? `${t('firstTo', lang)} ${match.targetScore} · ${t('service', lang)} ${match.server === 1 ? 'Player One' : 'Player Two'}`
                : t('returningToLobby', lang)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {match.playerOneScore} - {match.playerTwoScore}
          </p>
        </div>
      </main>
    </div>
  );
}
