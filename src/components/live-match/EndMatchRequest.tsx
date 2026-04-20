import { useState, useEffect } from 'react';
import { t, type Lang } from '@/lib/i18n';

interface EndMatchRequestProps {
  requesterName: string;
  lang: Lang;
  onAccept: () => void;
  onDecline: () => void;
  onTimeout: () => void;
}

const END_MATCH_TIMEOUT = 10;

export default function EndMatchRequest({ requesterName, lang, onAccept, onDecline, onTimeout }: EndMatchRequestProps) {
  const [secondsLeft, setSecondsLeft] = useState(END_MATCH_TIMEOUT);

  useEffect(() => {
    setSecondsLeft(END_MATCH_TIMEOUT);

    const deadline = Date.now() + END_MATCH_TIMEOUT * 1000;
    let hasTimedOut = false;

    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(next);

      if (next === 0 && !hasTimedOut) {
        hasTimedOut = true;
        window.clearInterval(timer);
        onTimeout();
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [onTimeout, requesterName]);

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
            onClick={onDecline}
            className="flex-1 rounded-2xl bg-muted py-3 font-bold text-muted-foreground active:scale-95"
          >
            {t('endMatchDecline', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
