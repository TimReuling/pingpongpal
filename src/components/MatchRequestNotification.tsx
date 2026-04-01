import { useState, useEffect } from 'react';
import type { MatchRequest } from '@/hooks/useMatchRequests';
import { t, type Lang } from '@/lib/i18n';

interface MatchRequestNotificationProps {
  requests: MatchRequest[];
  lang: Lang;
  onAccept: (request: MatchRequest) => void;
  onDecline: (requestId: string) => void;
}

const CHALLENGE_TIMEOUT_SECONDS = 30;

function ChallengeCard({ req, lang, onAccept, onDecline }: {
  req: MatchRequest;
  lang: Lang;
  onAccept: (request: MatchRequest) => void;
  onDecline: (requestId: string) => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const elapsed = (Date.now() - new Date(req.created_at).getTime()) / 1000;
    return Math.max(0, Math.ceil(CHALLENGE_TIMEOUT_SECONDS - elapsed));
  });

  useEffect(() => {
    if (secondsLeft <= 0) {
      onDecline(req.id);
      return;
    }
    const timer = window.setInterval(() => {
      setSecondsLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          onDecline(req.id);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [req.id, onDecline, secondsLeft <= 0]);

  if (secondsLeft <= 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-accent/10 border-2 border-accent/30 p-4 animate-in slide-in-from-top-2">
      {req.from_avatar ? (
        <img src={req.from_avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {req.from_name?.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1">
        <p className="font-semibold text-card-foreground">{req.from_name}</p>
        <p className="text-xs text-muted-foreground">
          {t('challengeFrom', lang)} · {t('targetScore', lang)}: {req.target_score}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-1000 ease-linear"
              style={{ width: `${(secondsLeft / CHALLENGE_TIMEOUT_SECONDS) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{secondsLeft}s</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onAccept(req)}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground active:scale-95"
        >
          {t('accept', lang)}
        </button>
        <button
          onClick={() => onDecline(req.id)}
          className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground active:scale-95"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function MatchRequestNotification({ requests, lang, onAccept, onDecline }: MatchRequestNotificationProps) {
  // Filter out requests older than 30s
  const validRequests = requests.filter(r => {
    const age = (Date.now() - new Date(r.created_at).getTime()) / 1000;
    return age < CHALLENGE_TIMEOUT_SECONDS;
  });

  if (validRequests.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        🏓 {t('pendingRequests', lang)}
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
          {validRequests.length}
        </span>
      </h3>
      {validRequests.map(req => (
        <ChallengeCard key={req.id} req={req} lang={lang} onAccept={onAccept} onDecline={onDecline} />
      ))}
    </div>
  );
}
