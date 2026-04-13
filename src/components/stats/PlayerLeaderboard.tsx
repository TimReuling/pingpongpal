import { type PlayerInsight } from '@/hooks/useStatsData';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  insights: PlayerInsight[];
}

function TrendIcon({ trend }: { trend: 'improving' | 'declining' | 'stable' }) {
  if (trend === 'improving') return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === 'declining') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function PlayerLeaderboard({ insights }: Props) {
  if (insights.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No players with matches yet</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {insights.map((s, i) => (
        <div key={s.profile_id} className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </span>
            {s.avatar_url ? (
              <img src={s.avatar_url} className="h-10 w-10 rounded-full object-cover" alt="" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
                {s.display_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-card-foreground truncate">{s.display_name}</p>
                <TrendIcon trend={s.trend} />
              </div>
              <p className="text-xs text-muted-foreground">
                {s.totalWon}W - {s.totalLost}L · {s.currentWinPct}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-primary">{s.totalWon}</p>
              <p className="text-[10px] text-muted-foreground">wins</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              { label: 'Played', value: s.totalPlayed },
              { label: 'Pts Scored', value: s.totalScored },
              { label: 'Pts Against', value: s.totalConceded },
              { label: 'Best Streak', value: s.bestStreak },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-muted/50 p-2 text-center">
                <p className="score-font text-lg font-bold text-foreground">{value}</p>
                <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Weekly form */}
          {(s.recentWins + s.recentLosses) > 0 && (
            <div className="mt-2 flex items-center gap-2 text-[11px]">
              <span className="text-muted-foreground">This week:</span>
              <span className="font-semibold text-card-foreground">{s.recentWins}W-{s.recentLosses}L</span>
              {s.winPctChange !== 0 && (
                <span className={`font-semibold ${s.winPctChange > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {s.winPctChange > 0 ? '+' : ''}{s.winPctChange}%
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
