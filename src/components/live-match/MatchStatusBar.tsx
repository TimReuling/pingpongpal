import { t, type Lang } from '@/lib/i18n';

interface MatchStatusBarProps {
  lang: Lang;
  targetScore: number;
  status: string;
  isInteractive: boolean;
  endMatchPending: boolean;
  onEndMatchRequest: () => void;
}

export default function MatchStatusBar({ lang, targetScore, status, isInteractive, endMatchPending, onEndMatchRequest }: MatchStatusBarProps) {
  return (
    <div className="safe-top border-b border-border bg-card/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold tracking-[0.18em] text-primary">
          <span className={`h-2.5 w-2.5 rounded-full ${isInteractive ? 'bg-primary animate-pulse' : 'bg-muted-foreground/50'}`} />
          {status === 'active' ? t('live', lang) : t('sharedMatch', lang)}
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{t('sharedMatch', lang)}</p>
          <p className="text-xs text-muted-foreground">
            {t('firstTo', lang)} {targetScore}
          </p>
        </div>

        {isInteractive && (
          <button
            onClick={onEndMatchRequest}
            disabled={endMatchPending}
            className="rounded-full bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground transition-transform active:scale-95 disabled:opacity-50"
          >
            {endMatchPending ? t('endMatchWaiting', lang) : t('endMatch', lang)}
          </button>
        )}

        {!isInteractive && (
          <div className="px-3 py-2 text-xs font-bold text-muted-foreground">
            {t('returningToLobby', lang)}
          </div>
        )}
      </div>
    </div>
  );
}
