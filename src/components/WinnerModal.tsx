import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { t, type Lang } from '@/lib/i18n';

interface WinnerModalProps {
  winnerName: string;
  score: string;
  onPlayAgain: () => void;
  onNewOpponent: () => void;
  lang: Lang;
}

export default function WinnerModal({ winnerName, score, onPlayAgain, onNewOpponent, lang }: WinnerModalProps) {
  useEffect(() => {
    // Fire confetti
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#22c55e', '#facc15', '#f97316'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#22c55e', '#facc15', '#f97316'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl bg-card p-8 shadow-2xl">
        <div className="text-6xl">🏆</div>
        <h2 className="text-3xl font-black text-card-foreground">{winnerName}</h2>
        <p className="text-xl font-bold text-primary">{t('winner', lang)}</p>
        <p className="score-font text-2xl font-bold text-muted-foreground">{score}</p>

        <div className="flex w-full flex-col gap-3 pt-2">
          <button
            onClick={onPlayAgain}
            className="w-full rounded-2xl bg-primary py-4 text-lg font-bold text-primary-foreground transition-all active:scale-95"
          >
            🔄 {t('playAgain', lang)}
          </button>
          <button
            onClick={onNewOpponent}
            className="w-full rounded-2xl bg-muted py-3 font-semibold text-muted-foreground transition-all active:scale-95"
          >
            {t('newMatch', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
