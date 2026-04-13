import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { type MatchRecord, type PlayerProfile } from '@/hooks/useStatsData';

interface Props {
  matches: MatchRecord[];
  profiles: PlayerProfile[];
}

const COLORS = ['hsl(142,70%,45%)', 'hsl(217,90%,60%)', 'hsl(45,90%,50%)', 'hsl(340,80%,55%)', 'hsl(280,70%,55%)'];

export default function PerformanceCharts({ matches, profiles }: Props) {
  const playerNames = useMemo(() => {
    const nameMap = new Map<string, string>();
    profiles.forEach(p => nameMap.set(p.id, p.display_name));
    return nameMap;
  }, [profiles]);

  // Cumulative wins over time per player
  const winsOverTime = useMemo(() => {
    if (matches.length === 0) return [];
    const cumWins = new Map<string, number>();
    const dataPoints: Record<string, any>[] = [];

    for (const m of matches) {
      if (!m.winner_id) continue;
      const name = playerNames.get(m.winner_id) ?? 'Unknown';
      cumWins.set(name, (cumWins.get(name) || 0) + 1);
      const d = m.completed_at ? new Date(m.completed_at) : new Date(m.created_at);
      const point: Record<string, any> = { date: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) };
      cumWins.forEach((v, k) => { point[k] = v; });
      dataPoints.push(point);
    }
    return dataPoints;
  }, [matches, playerNames]);

  // Weekly performance bars
  const weeklyData = useMemo(() => {
    const weekMap = new Map<string, Record<string, number>>();
    for (const m of matches) {
      if (!m.winner_id) continue;
      const d = m.completed_at ? new Date(m.completed_at) : new Date(m.created_at);
      const ws = new Date(d); ws.setDate(d.getDate() - d.getDay());
      const key = ws.toLocaleDateString('en', { month: 'short', day: 'numeric' });
      if (!weekMap.has(key)) weekMap.set(key, {});
      const name = playerNames.get(m.winner_id) ?? 'Unknown';
      const w = weekMap.get(key)!;
      w[name] = (w[name] || 0) + 1;
    }
    return Array.from(weekMap.entries()).map(([week, data]) => ({ week, ...data }));
  }, [matches, playerNames]);

  const uniquePlayers = useMemo(() => {
    const s = new Set<string>();
    matches.forEach(m => {
      if (m.winner_id) s.add(playerNames.get(m.winner_id) ?? 'Unknown');
    });
    return Array.from(s);
  }, [matches, playerNames]);

  if (matches.length === 0) {
    return <p className="py-8 text-center text-muted-foreground text-sm">No match data for charts</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cumulative wins */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Wins Over Time</h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={winsOverTime}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              {uniquePlayers.map((name, i) => (
                <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2} dot={false} connectNulls />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly wins bar chart */}
      {weeklyData.length > 1 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Weekly Wins</h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                {uniquePlayers.map((name, i) => (
                  <Bar key={name} dataKey={name} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
