import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TimeFilter = 'today' | '7days' | '30days' | 'month' | 'all';

export interface MatchRecord {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  target_score: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  player1_name: string;
  player2_name: string;
}

export interface PlayerProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface PlayerInsight {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  currentWinPct: number;
  prevWinPct: number;
  winPctChange: number;
  recentWins: number;
  recentLosses: number;
  recentScored: number;
  recentConceded: number;
  trend: 'improving' | 'declining' | 'stable';
  currentStreak: number;
  totalPlayed: number;
  totalWon: number;
  totalLost: number;
  totalScored: number;
  totalConceded: number;
  bestStreak: number;
}

function getFilterDate(filter: TimeFilter): Date | null {
  const now = new Date();
  switch (filter) {
    case 'today': {
      const d = new Date(now); d.setHours(0, 0, 0, 0); return d;
    }
    case '7days': return new Date(now.getTime() - 7 * 86400000);
    case '30days': return new Date(now.getTime() - 30 * 86400000);
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'all': return null;
  }
}

export function useStatsData() {
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [matchRes, profileRes] = await Promise.all([
      supabase.from('matches').select(`
        *,
        player1:profiles!matches_player1_id_fkey(display_name),
        player2:profiles!matches_player2_id_fkey(display_name)
      `).eq('status', 'finished').order('completed_at', { ascending: true }),
      supabase.from('profiles').select('id, display_name, avatar_url'),
    ]);

    if (matchRes.data) {
      setMatches(matchRes.data.map((m: any) => ({
        ...m,
        player1_name: m.player1?.display_name ?? 'Unknown',
        player2_name: m.player2?.display_name ?? 'Unknown',
      })));
    }
    if (profileRes.data) {
      setProfiles(profileRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refetch whenever any match is deleted (e.g. via the consent flow)
  // so leaderboards, charts, and compare stats stay in sync across all tabs.
  useEffect(() => {
    const channel = supabase
      .channel('stats-match-delete-sync')
      .on('postgres_changes' as any, { event: 'DELETE', schema: 'public', table: 'matches' }, () => {
        void fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const filteredMatches = useMemo(() => {
    const cutoff = getFilterDate(timeFilter);
    if (!cutoff) return matches;
    return matches.filter(m => {
      const d = m.completed_at ? new Date(m.completed_at) : new Date(m.created_at);
      return d >= cutoff;
    });
  }, [matches, timeFilter]);

  // Build per-player insights
  const insights = useMemo((): PlayerInsight[] => {
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);

    const playerMap = new Map<string, {
      name: string; avatar: string | null;
      totalW: number; totalL: number; totalS: number; totalC: number;
      recentW: number; recentL: number; recentS: number; recentC: number;
      prevW: number; prevL: number;
      streak: number; bestStreak: number;
    }>();

    for (const p of profiles) {
      playerMap.set(p.id, {
        name: p.display_name, avatar: p.avatar_url,
        totalW: 0, totalL: 0, totalS: 0, totalC: 0,
        recentW: 0, recentL: 0, recentS: 0, recentC: 0,
        prevW: 0, prevL: 0,
        streak: 0, bestStreak: 0,
      });
    }

    // Process all finished matches in chronological order
    for (const m of matches) {
      const md = m.completed_at ? new Date(m.completed_at) : new Date(m.created_at);
      for (const pid of [m.player1_id, m.player2_id]) {
        const s = playerMap.get(pid);
        if (!s) continue;
        const myScore = pid === m.player1_id ? m.player1_score : m.player2_score;
        const oppScore = pid === m.player1_id ? m.player2_score : m.player1_score;
        const won = m.winner_id === pid;

        s.totalS += myScore;
        s.totalC += oppScore;
        if (won) { s.totalW++; s.streak++; if (s.streak > s.bestStreak) s.bestStreak = s.streak; }
        else { s.totalL++; s.streak = 0; }

        if (md >= oneWeekAgo) {
          if (won) s.recentW++; else s.recentL++;
          s.recentS += myScore; s.recentC += oppScore;
        } else if (md >= twoWeeksAgo) {
          if (won) s.prevW++; else s.prevL++;
        }
      }
    }

    return Array.from(playerMap.entries())
      .filter(([, s]) => s.totalW + s.totalL > 0)
      .map(([id, s]) => {
        const totalPlayed = s.totalW + s.totalL;
        const currentWinPct = totalPlayed > 0 ? Math.round((s.totalW / totalPlayed) * 100) : 0;
        const recentPlayed = s.recentW + s.recentL;
        const prevPlayed = s.prevW + s.prevL;
        const recentPct = recentPlayed > 0 ? (s.recentW / recentPlayed) * 100 : 0;
        const prevPct = prevPlayed > 0 ? (s.prevW / prevPlayed) * 100 : currentWinPct;
        const winPctChange = Math.round(recentPct - prevPct);
        const trend: 'improving' | 'declining' | 'stable' =
          winPctChange > 5 ? 'improving' : winPctChange < -5 ? 'declining' : 'stable';

        return {
          profile_id: id, display_name: s.name, avatar_url: s.avatar,
          currentWinPct, prevWinPct: Math.round(prevPct), winPctChange,
          recentWins: s.recentW, recentLosses: s.recentL,
          recentScored: s.recentS, recentConceded: s.recentC,
          trend, currentStreak: s.streak,
          totalPlayed, totalWon: s.totalW, totalLost: s.totalL,
          totalScored: s.totalS, totalConceded: s.totalC,
          bestStreak: s.bestStreak,
        };
      })
      .sort((a, b) => b.totalWon - a.totalWon);
  }, [matches, profiles]);

  // Chart data: wins over time per player (weekly buckets)
  const chartData = useMemo(() => {
    if (filteredMatches.length === 0) return { weekly: [], monthly: [] };

    const weeklyMap = new Map<string, Record<string, number>>();
    const monthlyMap = new Map<string, Record<string, number>>();

    for (const m of filteredMatches) {
      if (!m.winner_id) continue;
      const d = m.completed_at ? new Date(m.completed_at) : new Date(m.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      const monthKey = d.toISOString().slice(0, 7);

      const winnerName = m.winner_id === m.player1_id ? m.player1_name : m.player2_name;

      if (!weeklyMap.has(weekKey)) weeklyMap.set(weekKey, {});
      const w = weeklyMap.get(weekKey)!;
      w[winnerName] = (w[winnerName] || 0) + 1;

      if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, {});
      const mo = monthlyMap.get(monthKey)!;
      mo[winnerName] = (mo[winnerName] || 0) + 1;
    }

    const weekly = Array.from(weeklyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({ week, ...data }));

    const monthly = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    return { weekly, monthly };
  }, [filteredMatches]);

  // Head-to-head between two players
  const getHeadToHead = useCallback((p1: string, p2: string) => {
    const h2h = filteredMatches.filter(m =>
      (m.player1_id === p1 && m.player2_id === p2) ||
      (m.player1_id === p2 && m.player2_id === p1)
    );
    let p1Wins = 0, p2Wins = 0, p1Scored = 0, p2Scored = 0;
    for (const m of h2h) {
      const s1 = m.player1_id === p1 ? m.player1_score : m.player2_score;
      const s2 = m.player1_id === p1 ? m.player2_score : m.player1_score;
      p1Scored += s1; p2Scored += s2;
      if (m.winner_id === p1) p1Wins++;
      else if (m.winner_id === p2) p2Wins++;
    }
    return { matches: h2h.length, p1Wins, p2Wins, p1Scored, p2Scored };
  }, [filteredMatches]);

  const deleteMatch = useCallback(async (matchId: string) => {
    const { error } = await supabase.rpc('delete_match_and_recalculate', { p_match_id: matchId });
    if (error) throw error;
    await fetchData();
  }, [fetchData]);

  const deletePlayerMatches = useCallback(async (profileId: string) => {
    const { error } = await supabase.rpc('delete_player_matches', { p_profile_id: profileId });
    if (error) throw error;
    await fetchData();
  }, [fetchData]);

  const resetAllStats = useCallback(async () => {
    const { error } = await supabase.rpc('reset_all_stats');
    if (error) throw error;
    await fetchData();
  }, [fetchData]);

  return {
    matches: filteredMatches, allMatches: matches, profiles, loading,
    timeFilter, setTimeFilter, insights, chartData,
    getHeadToHead, deleteMatch, deletePlayerMatches, resetAllStats,
    refetch: fetchData,
  };
}
