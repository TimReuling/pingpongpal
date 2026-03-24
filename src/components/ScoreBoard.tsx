import { useState, useCallback, useEffect } from 'react';
import type { Tables } from '@/integrations/supabase/types';
import { t, type Lang } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeMatch } from '@/hooks/useRealtimeMatch';
import { playScoreUp, playScoreDown, playServiceChange } from '@/lib/sounds';
import { hasValidSessionPlayers, resolveSessionPlayers } from '@/lib/matchSession';
import WinnerModal from './WinnerModal';

interface ScoreBoardProps {
  player1: Tables<'profiles'>;
  player2: Tables<'profiles'>;
  matchId: string;
  lang: Lang;
  onNavigate: (page: 'stats' | 'settings') => void;
  onNewMatch: () => void;
  onMatchComplete: () => void;
  soundEnabled: boolean;
}

export default function ScoreBoard({
  player1, player2, matchId, lang, onNavigate, onNewMatch, onMatchComplete, soundEnabled,
}: ScoreBoardProps) {
  const { match, updateScore, closeMatch } = useRealtimeMatch(matchId);
  const [showWinner, setShowWinner] = useState(false);
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);
  const [animatingPlayer, setAnimatingPlayer] = useState<1 | 2 | null>(null);
  const [prevScores, setPrevScores] = useState<{ p1: number; p2: number } | null>(null);

  const { playerOne, playerTwo } = match
    ? resolveSessionPlayers([player1, player2], match.player1Id, match.player2Id)
    : { playerOne: player1, playerTwo: player2 };

  const loadWins = useCallback(async () => {
    if (!playerOne || !playerTwo) return;

    const [r1, r2] = await Promise.all([
      supabase.from('player_stats').select('matches_won').eq('profile_id', playerOne.id).single(),
      supabase.from('player_stats').select('matches_won').eq('profile_id', playerTwo.id).single(),
    ]);
    setP1Wins(r1.data?.matches_won ?? 0);
    setP2Wins(r2.data?.matches_won ?? 0);
  }, [playerOne, playerTwo]);

  useEffect(() => {
    loadWins();
  }, [loadWins]);

  // Sound effects on score changes (from realtime updates too)
  useEffect(() => {
    if (!match || !soundEnabled) return;
    if (!prevScores) {
      setPrevScores({ p1: match.player1Score, p2: match.player2Score });
      return;
    }
    const p1Diff = match.player1Score - prevScores.p1;
    const p2Diff = match.player2Score - prevScores.p2;
    const totalDiff = p1Diff + p2Diff;

    if (totalDiff > 0) {
      playScoreUp();
      if (p1Diff > 0) setAnimatingPlayer(1);
      else if (p2Diff > 0) setAnimatingPlayer(2);
      setTimeout(() => setAnimatingPlayer(null), 200);
    } else if (totalDiff < 0) {
      playScoreDown();
    }

    setPrevScores({ p1: match.player1Score, p2: match.player2Score });
  }, [match?.player1Score, match?.player2Score]);

  useEffect(() => {
    if (!match || match.status !== 'finished' || !match.winnerId) return;

    const timer = setTimeout(() => {
      setShowWinner(true);
      loadWins();
      onMatchComplete();
    }, 300);
    return () => clearTimeout(timer);
  }, [match?.status, match?.winnerId, loadWins, onMatchComplete]);

  useEffect(() => {
    if (!showWinner) return;

    const timer = setTimeout(() => {
      setShowWinner(false);
      onNewMatch();
    }, 4000);

    return () => clearTimeout(timer);
  }, [showWinner, onNewMatch]);

  const handleScore = useCallback(async (player: 1 | 2, delta: 1 | -1) => {
    if (!match) return;
    const prevServer = match.server;
    const result = await updateScore(player, delta);
    if (result && soundEnabled && result.server !== prevServer && result.status === 'active') {
      setTimeout(() => playServiceChange(), 150);
    }
  }, [match, updateScore, soundEnabled]);

  const handlePlayAgain = async () => {
    if (!playerOne || !playerTwo) return;

    setShowWinner(false);
    setPrevScores(null);
    // Navigate back to lobby so the user can start a fresh match
    onNewMatch();
  };

  const handleNewOpponent = async () => {
    if (match?.status === 'active') {
      await closeMatch('abandoned');
    }
    setShowWinner(false);
    onNewMatch();
  };

  if (!match) {
    return (
      <div className="flex h-dvh items-center justify-center bg-table-green-dark">
        <div className="text-2xl font-bold text-primary-foreground">Loading match...</div>
      </div>
    );
  }

  if (
    !playerOne ||
    !playerTwo ||
    !hasValidSessionPlayers({ player1Id: match.player1Id, player2Id: match.player2Id })
  ) {
    return (
      <div className="flex h-dvh items-center justify-center bg-table-green-dark">
        <div className="text-center text-primary-foreground">
          <div className="text-2xl font-bold">Loading shared session...</div>
          <div className="mt-2 text-sm text-primary-foreground/70">Syncing player mapping</div>
        </div>
      </div>
    );
  }

  const isComplete = match.status !== 'active';

  return (
    <>
      <div className="flex h-dvh flex-col overflow-hidden">
        <PlayerHalf
          player={playerOne}
          score={match.player1Score}
          wins={p1Wins}
          isServing={match.server === 1}
          isActive={!isComplete}
          animating={animatingPlayer === 1}
          onPlus={() => handleScore(1, 1)}
          onMinus={() => handleScore(1, -1)}
          rotated
          lang={lang}
        />

        <div className="relative z-10 flex min-h-16 items-center justify-center bg-card px-4 py-3 shadow-md">
          <div className="absolute left-0 right-0 top-0 h-0.5 bg-border" />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">LIVE</span>
          </div>
          <div className="flex gap-3 pr-16">
            <button
              onClick={() => onNavigate('stats')}
              className="rounded-full bg-muted px-4 py-1.5 text-sm font-semibold text-muted-foreground transition-all active:scale-95"
            >
              📊 {t('stats', lang)}
            </button>
            <button
              onClick={handleNewOpponent}
              className="rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary transition-all active:scale-95"
            >
              🔄 {t('newMatch', lang)}
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className="rounded-full bg-muted px-4 py-1.5 text-sm font-semibold text-muted-foreground transition-all active:scale-95"
            >
              ⚙️ {t('settings', lang)}
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border" />
        </div>

        <PlayerHalf
          player={playerTwo}
          score={match.player2Score}
          wins={p2Wins}
          isServing={match.server === 2}
          isActive={!isComplete}
          animating={animatingPlayer === 2}
          onPlus={() => handleScore(2, 1)}
          onMinus={() => handleScore(2, -1)}
          lang={lang}
        />
      </div>

      {showWinner && match.winnerId && (
        <WinnerModal
          winnerName={match.winnerId === playerOne.id ? playerOne.display_name : playerTwo.display_name}
          score={`${match.player1Score} - ${match.player2Score}`}
          onPlayAgain={handlePlayAgain}
          onNewOpponent={handleNewOpponent}
          lang={lang}
          soundEnabled={soundEnabled}
        />
      )}
    </>
  );
}

/* ─── Ping Pong Paddle SVG Icon ─── */
function PaddleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="30" cy="24" rx="18" ry="22" fill="hsl(var(--service-indicator))" opacity="0.9" />
      <ellipse cx="30" cy="24" rx="14" ry="18" fill="hsl(var(--service-indicator))" opacity="0.6" />
      <rect x="26" y="44" width="8" height="16" rx="3" fill="hsl(var(--primary-foreground))" opacity="0.7" />
      <circle cx="48" cy="12" r="6" fill="hsl(var(--primary-foreground))" opacity="0.85" />
    </svg>
  );
}

interface PlayerHalfProps {
  player: Tables<'profiles'>;
  score: number;
  wins: number;
  isServing: boolean;
  isActive: boolean;
  animating: boolean;
  onPlus: () => void;
  onMinus: () => void;
  rotated?: boolean;
  lang: Lang;
}

function PlayerHalf({
  player, score, wins, isServing, isActive, animating, onPlus, onMinus, rotated, lang,
}: PlayerHalfProps) {
  return (
    <div
      className={`relative flex flex-1 flex-col items-center justify-center ${
        rotated ? 'player-section-top' : 'player-section-bottom'
      } ${isServing && isActive ? 'active-glow' : ''}`}
      style={rotated ? { transform: 'rotate(180deg)' } : undefined}
    >
      {/* Enhanced service indicator */}
      {isServing && isActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
          <PaddleIcon className="h-8 w-8" />
          <div className="service-dot-large" />
          <span className="text-sm font-bold uppercase tracking-wider text-primary-foreground/80">
            {t('service', lang)}
          </span>
        </div>
      )}

      {/* Player avatar + name */}
      <div className="flex items-center gap-3">
        {player.avatar_url ? (
          <img src={player.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover border-2 border-primary-foreground/30" />
        ) : null}
        <p className={`font-bold tracking-tight text-primary-foreground transition-all duration-300 ${
          isServing && isActive ? 'text-2xl' : 'text-xl'
        }`}>
          {player.display_name}
        </p>
      </div>

      {/* Score */}
      <p className={`score-font text-8xl font-bold text-primary-foreground leading-none my-2 transition-transform duration-200 ${
        animating ? 'animate-score-pop' : ''
      }`}>
        {score}
      </p>

      {/* Wins */}
      <p className="text-sm font-medium text-primary-foreground/60">
        {wins} {t('matchesWon', lang).toLowerCase()}
      </p>

      {/* Buttons */}
      <div className="absolute bottom-6 left-6 right-6 flex justify-between safe-bottom">
        <button onClick={onPlus} className="score-btn score-btn-plus h-16 w-20">
          +1
        </button>
        <button onClick={onMinus} className="score-btn score-btn-minus h-14 w-16 text-xl">
          −1
        </button>
      </div>
    </div>
  );
}
