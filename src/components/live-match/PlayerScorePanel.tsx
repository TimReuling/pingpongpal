import type { Tables } from '@/integrations/supabase/types';
import { t, type Lang } from '@/lib/i18n';

interface PlayerScorePanelProps {
  player: Tables<'profiles'>;
  score: number;
  side: 'playerOne' | 'playerTwo';
  isServing: boolean;
  isInteractive: boolean;
  lang: Lang;
  onPlus: () => void;
  onMinus: () => void;
}

export default function PlayerScorePanel({
  player,
  score,
  side,
  isServing,
  isInteractive,
  lang,
  onPlus,
  onMinus,
}: PlayerScorePanelProps) {
  const sideTheme = side === 'playerOne'
    ? 'border-primary/25 bg-primary/10'
    : 'border-accent/30 bg-accent/10';
  const activeTheme = isServing && isInteractive
    ? side === 'playerOne'
      ? 'ring-2 ring-primary/30 shadow-lg shadow-primary/15'
      : 'ring-2 ring-accent/30 shadow-lg shadow-accent/15'
    : '';

  return (
    <section className={`flex min-w-0 flex-1 flex-col rounded-[2rem] border ${sideTheme} ${activeTheme} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {side === 'playerOne' ? 'PLAYER ONE' : 'PLAYER TWO'}
          </p>
          <div className="mt-2 flex items-center gap-3">
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                alt={player.display_name}
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-lg font-bold text-foreground">
                {player.display_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-foreground">{player.display_name}</p>
              <p className="text-xs text-muted-foreground">
                {isServing && isInteractive ? t('service', lang) : ' '}
              </p>
            </div>
          </div>
        </div>

        {isServing && isInteractive && <div className="service-dot-large shrink-0" />}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-8 text-center">
        <div className="score-font text-7xl font-black leading-none text-foreground sm:text-8xl">
          {score}
        </div>

        <div className="flex w-full max-w-xs items-center justify-center gap-3">
          <button
            onClick={onMinus}
            disabled={!isInteractive}
            className="score-btn score-btn-minus h-16 flex-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            −1
          </button>
          <button
            onClick={onPlus}
            disabled={!isInteractive}
            className="score-btn score-btn-plus h-16 flex-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            +1
          </button>
        </div>
      </div>
    </section>
  );
}