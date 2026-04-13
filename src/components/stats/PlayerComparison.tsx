import { useState, useMemo } from 'react';
import { type PlayerInsight, type PlayerProfile } from '@/hooks/useStatsData';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  insights: PlayerInsight[];
  profiles: PlayerProfile[];
  getHeadToHead: (p1: string, p2: string) => {
    matches: number; p1Wins: number; p2Wins: number; p1Scored: number; p2Scored: number;
  };
}

function TrendBadge({ trend }: { trend: 'improving' | 'declining' | 'stable' }) {
  if (trend === 'improving') return <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600"><TrendingUp className="h-3 w-3" />Improving</span>;
  if (trend === 'declining') return <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-500"><TrendingDown className="h-3 w-3" />Declining</span>;
  return <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground"><Minus className="h-3 w-3" />Stable</span>;
}

export default function PlayerComparison({ insights, profiles, getHeadToHead }: Props) {
  const [p1Id, setP1Id] = useState<string>('');
  const [p2Id, setP2Id] = useState<string>('');

  const activePlayers = useMemo(() =>
    profiles.filter(p => insights.some(i => i.profile_id === p.id)),
    [profiles, insights]
  );

  const p1 = insights.find(i => i.profile_id === p1Id);
  const p2 = insights.find(i => i.profile_id === p2Id);
  const h2h = p1Id && p2Id ? getHeadToHead(p1Id, p2Id) : null;

  const rows = p1 && p2 ? [
    { label: 'Played', v1: p1.totalPlayed, v2: p2.totalPlayed },
    { label: 'Won', v1: p1.totalWon, v2: p2.totalWon },
    { label: 'Lost', v1: p1.totalLost, v2: p2.totalLost },
    { label: 'Win %', v1: `${p1.currentWinPct}%`, v2: `${p2.currentWinPct}%` },
    { label: 'Pts Scored', v1: p1.totalScored, v2: p2.totalScored },
    { label: 'Pts Conceded', v1: p1.totalConceded, v2: p2.totalConceded },
    { label: 'Current Streak', v1: p1.currentStreak, v2: p2.currentStreak },
    { label: 'Best Streak', v1: p1.bestStreak, v2: p2.bestStreak },
  ] : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <select
          value={p1Id}
          onChange={e => setP1Id(e.target.value)}
          className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground"
        >
          <option value="">Player 1</option>
          {activePlayers.map(p => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </select>
        <select
          value={p2Id}
          onChange={e => setP2Id(e.target.value)}
          className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground"
        >
          <option value="">Player 2</option>
          {activePlayers.map(p => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </select>
      </div>

      {p1 && p2 && (
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          {/* Head to Head */}
          {h2h && h2h.matches > 0 && (
            <div className="mb-3 rounded-xl bg-primary/5 p-3 text-center">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Head to Head</p>
              <p className="text-lg font-bold text-foreground">
                <span className={h2h.p1Wins > h2h.p2Wins ? 'text-primary' : ''}>{h2h.p1Wins}</span>
                {' - '}
                <span className={h2h.p2Wins > h2h.p1Wins ? 'text-primary' : ''}>{h2h.p2Wins}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">{h2h.matches} matches</p>
            </div>
          )}

          {/* Trend badges */}
          <div className="flex justify-between mb-3">
            <div className="text-center">
              <p className="text-sm font-bold text-card-foreground">{p1.display_name}</p>
              <TrendBadge trend={p1.trend} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-card-foreground">{p2.display_name}</p>
              <TrendBadge trend={p2.trend} />
            </div>
          </div>

          {/* Stat comparison rows */}
          <div className="flex flex-col gap-1.5">
            {rows.map(r => {
              const v1Num = typeof r.v1 === 'number' ? r.v1 : parseFloat(String(r.v1));
              const v2Num = typeof r.v2 === 'number' ? r.v2 : parseFloat(String(r.v2));
              const highlight = r.label !== 'Lost' && r.label !== 'Pts Conceded';
              return (
                <div key={r.label} className="flex items-center text-sm">
                  <span className={`flex-1 text-right font-semibold ${highlight && v1Num > v2Num ? 'text-primary' : 'text-card-foreground'}`}>
                    {r.v1}
                  </span>
                  <span className="w-24 text-center text-xs text-muted-foreground">{r.label}</span>
                  <span className={`flex-1 font-semibold ${highlight && v2Num > v1Num ? 'text-primary' : 'text-card-foreground'}`}>
                    {r.v2}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(!p1Id || !p2Id) && (
        <p className="py-6 text-center text-sm text-muted-foreground">Select two players to compare</p>
      )}
    </div>
  );
}
