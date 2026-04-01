import { useState, useEffect } from 'react';
import { t, type Lang } from '@/lib/i18n';

interface EndMatchRequestProps {
  requesterName: string;
  lang: Lang;
  onAccept: () => void;
  onTimeout: () => void;
}

const END_MATCH_TIMEOUT = 10;

export default function EndMatchRequest({ requesterName, lang, onAccept, onTimeout }: EndMatchRequestProps) {
  const [secondsLeft, setSecondsLeft] = useState(END_MATCH_TIMEOUT);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onTimeout();
      return;
    }
    const timer = window.setInterval(() => {
      setSecondsLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          onTimeout();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onTimeout, secondsLeft <= 0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl bg-card p-6 shadow-2xl animate-in zoom-in-95">
        <div className="text-4xl">🚪</div>
        <h2 className="text-xl font-black text-card-foreground text-center">
          {requesterName} {t('endMatchRequest', lang)}
        </h2>

        <div className="w-full">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-destructive transition-all duration-1000 ease-linear"
              style={{ width: `${(secondsLeft / END_MATCH_TIMEOUT) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-center text-xs font-bold text-muted-foreground tabular-nums">
            {secondsLeft}s
          </p>
        </div>

        <div className="flex w-full gap-3">
          <button
            onClick={onAccept}
            className="flex-1 rounded-2xl bg-destructive py-3 font-bold text-destructive-foreground active:scale-95"
          >
            {t('endMatchAccept', lang)}
          </button>
          <button
            onClick={onTimeout}
            className="flex-1 rounded-2xl bg-muted py-3 font-bold text-muted-foreground active:scale-95"
          >
            {t('endMatchDecline', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
