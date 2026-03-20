import { useState, useCallback, useRef, useEffect } from 'react';
import type { Tables } from '@/integrations/supabase/types';
import { t, type Lang } from '@/lib/i18n';
import { getInitialMatchState, updateScore, type MatchState } from '@/lib/scoring';
import { supabase } from '@/integrations/supabase/client';
import { playScoreUp, playScoreDown, playServiceChange } from '@/lib/sounds';
import WinnerModal from './WinnerModal';

interface ScoreBoardProps {
  player1: Tables<'profiles'>;
  player2: Tables<'profiles'>;
  targetScore: number;
  lang: Lang;
  onNavigate: (page: 'stats' | 'settings') => void;
  onNewMatch: () => void;
  onMatchComplete: () => void;
  soundEnabled: boolean;
}

export default function ScoreBoard({
  player1, player2, targetScore, lang, onNavigate, onNewMatch, onMatchComplete, soundEnabled
}: ScoreBoardProps) {
  const [matchState, setMatchState] = useState<MatchState>(() => getInitialMatchState(targetScore));
  const [firstServer] = useState<1 | 2>(1);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);
  const [animatingPlayer, setAnimatingPlayer] = useState<1 | 2 | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const loadWins = async () => {
      const [r1, r2] = await Promise.all([
        supabase.from('player_stats').select('matches_won').eq('profile_id', player1.id).single(),
        supabase.from('player_stats').select('matches_won').eq('profile_id', player2.id).single(),
      ]);
      setP1Wins(r1.data?.matches_won ?? 0);
      setP2Wins(r2.data?.matches_won ?? 0);
    };
    loadWins();
  }, [player1.id, player2.id]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const createMatch = async () => {
      const { data } = await supabase
        .from('matches')
        .insert({ player1_id: player1.id, player2_id: player2.id, target_score: targetScore })
        .select('id')
        .single();
      if (data) setMatchId(data.id);
    };
    createMatch();
  }, [player1.id, player2.id, targetScore]);

  const saveScore = useCallback(async (state: MatchState) => {
    if (!matchId) return;
    const update: any = {
      player1_score: state.player1Score,
      player2_score: state.player2Score,
    };
    if (state.isComplete && state.winner) {
      update.status = 'completed';
      update.winner_id = state.winner === 1 ? player1.id : player2.id;
      update.completed_at = new Date().toISOString();
    }
    await supabase.from('matches').update(update).eq('id', matchId);
  }, [matchId, player1.id, player2.id]);

  const updateStats = useCallback(async (winner: 1 | 2, finalState: MatchState) => {
    const winnerId = winner === 1 ? player1.id : player2.id;
    const loserId = winner === 1 ? player2.id : player1.id;
    const winnerScored = winner === 1 ? finalState.player1Score : finalState.player2Score;
    const loserScored = winner === 1 ? finalState.player2Score : finalState.player1Score;

    const { data: winnerStats } = await supabase
      .from('player_stats').select('*').eq('profile_id', winnerId).single();
    if (winnerStats) {
      const newStreak = (winnerStats.current_win_streak || 0) + 1;
      await supabase.from('player_stats').update({
        matches_played: winnerStats.matches_played + 1,
        matches_won: winnerStats.matches_won + 1,
        total_points_scored: winnerStats.total_points_scored + winnerScored,
        total_points_conceded: winnerStats.total_points_conceded + loserScored,
        current_win_streak: newStreak,
        best_win_streak: Math.max(winnerStats.best_win_streak, newStreak),
      }).eq('profile_id', winnerId);
    }

    const { data: loserStats } = await supabase
      .from('player_stats').select('*').eq('profile_id', loserId).single();
    if (loserStats) {
      await supabase.from('player_stats').update({
        matches_played: loserStats.matches_played + 1,
        matches_lost: loserStats.matches_lost + 1,
        total_points_scored: loserStats.total_points_scored + loserScored,
        total_points_conceded: loserStats.total_points_conceded + winnerScored,
        current_win_streak: 0,
      }).eq('profile_id', loserId);
    }
  }, [player1.id, player2.id]);

  const handleScore = useCallback((player: 1 | 2, delta: 1 | -1) => {
    setMatchState(prev => {
      if (prev.isComplete && delta === 1) return prev;
      const prevServer = prev.server;
      const newState = updateScore(prev, player, delta, firstServer);

      if (soundEnabled) {
        if (delta === 1) playScoreUp();
        else playScoreDown();
        if (newState.server !== prevServer && !newState.isComplete) {
          setTimeout(() => soundEnabled && playServiceChange(), 150);
        }
      }

      if (delta === 1) {
        setAnimatingPlayer(player);
        setTimeout(() => setAnimatingPlayer(null), 200);
      }

      saveScore(newState);

      if (newState.isComplete && newState.winner) {
        setTimeout(() => {
          setShowWinner(true);
          updateStats(newState.winner!, newState);
          if (newState.winner === 1) setP1Wins(w => w + 1);
          else setP2Wins(w => w + 1);
          onMatchComplete();
        }, 300);
      }

      return newState;
    });
  }, [firstServer, saveScore, updateStats, onMatchComplete, soundEnabled]);

  const handlePlayAgain = () => {
    setShowWinner(false);
    setMatchState(getInitialMatchState(targetScore));
    initialized.current = false;
    setMatchId(null);
    const createMatch = async () => {
      const { data } = await supabase
        .from('matches')
        .insert({ player1_id: player1.id, player2_id: player2.id, target_score: targetScore })
        .select('id')
        .single();
      if (data) setMatchId(data.id);
    };
    createMatch();
  };

  const handleNewOpponent = () => {
    setShowWinner(false);
    onNewMatch();
  };

  return (
    <>
      <div className="flex h-dvh flex-col overflow-hidden">
        <PlayerHalf
          player={player1}
          score={matchState.player1Score}
          wins={p1Wins}
          isServing={matchState.server === 1}
          isActive={!matchState.isComplete}
          animating={animatingPlayer === 1}
          onPlus={() => handleScore(1, 1)}
          onMinus={() => handleScore(1, -1)}
          rotated
          lang={lang}
        />

        <div className="relative z-10 flex h-14 items-center justify-center bg-card shadow-md">
          <div className="absolute left-0 right-0 top-0 h-0.5 bg-border" />
          <div className="flex gap-6">
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
          player={player2}
          score={matchState.player2Score}
          wins={p2Wins}
          isServing={matchState.server === 2}
          isActive={!matchState.isComplete}
          animating={animatingPlayer === 2}
          onPlus={() => handleScore(2, 1)}
          onMinus={() => handleScore(2, -1)}
          lang={lang}
        />
      </div>

      {showWinner && matchState.winner && (
        <WinnerModal
          winnerName={matchState.winner === 1 ? player1.display_name : player2.display_name}
          score={`${matchState.player1Score} - ${matchState.player2Score}`}
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
  player, score, wins, isServing, isActive, animating, onPlus, onMinus, rotated, lang
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
