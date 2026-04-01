import { t, type Lang } from '@/lib/i18n';

interface RematchPopupProps {
  lang: Lang;
  waitingForOpponent: boolean;
  onRematch: () => void;
  onExit: () => void;
}

export default function RematchPopup({ lang, waitingForOpponent, onRematch, onExit }: RematchPopupProps) {
  if (waitingForOpponent) {
    return (
      <div className="flex w-full flex-col gap-3 pt-2">
        <div className="flex items-center justify-center gap-2 py-3">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-semibold text-muted-foreground">{t('endMatchWaiting', lang)}</span>
        </div>
        <button
          onClick={onExit}
          className="w-full rounded-2xl bg-muted py-3 font-semibold text-muted-foreground transition-all active:scale-95"
        >
          {t('newMatch', lang)}
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 pt-2">
      <button
        onClick={onRematch}
        className="w-full rounded-2xl bg-primary py-4 text-lg font-bold text-primary-foreground transition-all active:scale-95"
      >
        🔄 {t('rematch', lang)}
      </button>
      <button
        onClick={onExit}
        className="w-full rounded-2xl bg-muted py-3 font-semibold text-muted-foreground transition-all active:scale-95"
      >
        {t('newMatch', lang)}
      </button>
    </div>
  );
}
