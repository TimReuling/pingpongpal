import { type PlayerInsight } from '@/hooks/useStatsData';
import { TrendingUp, TrendingDown, Minus, Trophy, Flame, AlertTriangle } from 'lucide-react';

interface Props {
  insights: PlayerInsight[];
}

export default function InsightCards({ insights }: Props) {
  if (insights.length === 0) return null;

  const mostImproved = [...insights].sort((a, b) => b.winPctChange - a.winPctChange)[0];
  const biggestDrop = [...insights].sort((a, b) => a.winPctChange - b.winPctChange)[0];
  const longestStreak = [...insights].sort((a, b) => b.currentStreak - a.currentStreak)[0];
  const bestWinRate = [...insights].sort((a, b) => b.currentWinPct - a.currentWinPct)[0];
  const strongWeek = [...insights].filter(p => p.recentWins + p.recentLosses >= 2).sort((a, b) => {
    const aRate = a.recentWins / (a.recentWins + a.recentLosses);
    const bRate = b.recentWins / (b.recentWins + b.recentLosses);
    return bRate - aRate;
  })[0];

  const cards = [
    mostImproved && mostImproved.winPctChange > 0 && {
      icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
      title: 'Most Improved',
      player: mostImproved.display_name,
      detail: `+${mostImproved.winPctChange}% win rate this week`,
      color: 'border-emerald-500/30 bg-emerald-500/5',
    },
    biggestDrop && biggestDrop.winPctChange < -5 && {
      icon: <TrendingDown className="h-4 w-4 text-red-500" />,
      title: 'Biggest Drop',
      player: biggestDrop.display_name,
      detail: `${biggestDrop.winPctChange}% win rate this week`,
      color: 'border-red-500/30 bg-red-500/5',
    },
    longestStreak && longestStreak.currentStreak >= 2 && {
      icon: <Flame className="h-4 w-4 text-orange-500" />,
      title: 'On Fire',
      player: longestStreak.display_name,
      detail: `${longestStreak.currentStreak} win streak`,
      color: 'border-orange-500/30 bg-orange-500/5',
    },
    bestWinRate && {
      icon: <Trophy className="h-4 w-4 text-yellow-500" />,
      title: 'Best Win Rate',
      player: bestWinRate.display_name,
      detail: `${bestWinRate.currentWinPct}% (${bestWinRate.totalWon}W-${bestWinRate.totalLost}L)`,
      color: 'border-yellow-500/30 bg-yellow-500/5',
    },
    strongWeek && {
      icon: <TrendingUp className="h-4 w-4 text-blue-500" />,
      title: 'Strong Week',
      player: strongWeek.display_name,
      detail: `${strongWeek.recentWins}W-${strongWeek.recentLosses}L this week`,
      color: 'border-blue-500/30 bg-blue-500/5',
    },
  ].filter(Boolean) as { icon: React.ReactNode; title: string; player: string; detail: string; color: string }[];

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.slice(0, 4).map(card => (
        <div key={card.title} className={`rounded-xl border p-3 ${card.color}`}>
          <div className="flex items-center gap-1.5 mb-1">
            {card.icon}
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{card.title}</span>
          </div>
          <p className="text-sm font-bold text-card-foreground truncate">{card.player}</p>
          <p className="text-[11px] text-muted-foreground">{card.detail}</p>
        </div>
      ))}
    </div>
  );
}
