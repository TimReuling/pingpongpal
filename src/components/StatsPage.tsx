import { usePlayerStats } from '@/hooks/usePlayerStats';
import { useMatchHistory } from '@/hooks/useMatchHistory';
import { t, type Lang } from '@/lib/i18n';

interface StatsPageProps {
  lang: Lang;
  onBack: () => void;
}

export default function StatsPage({ lang, onBack }: StatsPageProps) {
  const { stats, loading: statsLoading } = usePlayerStats();
  const { matches, loading: matchesLoading } = useMatchHistory();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 bg-table-green-dark px-4 py-5">
        <button onClick={onBack} className="rounded-xl bg-primary-foreground/10 px-3 py-2 text-primary-foreground font-semibold active:scale-95">
          ← {t('back', lang)}
        </button>
        <h1 className="text-xl font-bold text-primary-foreground">{t('stats', lang)}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-lg flex flex-col gap-6">
          {/* Leaderboard */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-foreground">{t('leaderboard', lang)}</h2>
            {statsLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : stats.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">{t('noPlayers', lang)}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.map((s, i) => {
                  const winRate = s.matches_played > 0
                    ? Math.round((s.matches_won / s.matches_played) * 100)
                    : 0;
                  return (
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
                        <div className="flex-1">
                          <p className="font-bold text-card-foreground">{s.display_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.matches_won}W - {s.matches_lost}L · {winRate}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-primary">{s.matches_won}</p>
                          <p className="text-xs text-muted-foreground">{t('matchesWon', lang).toLowerCase()}</p>
                        </div>
                      </div>

                      {/* Detailed stats */}
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {[
                          { label: t('matchesPlayed', lang), value: s.matches_played },
                          { label: t('pointsScored', lang), value: s.total_points_scored },
                          { label: t('pointsConceded', lang), value: s.total_points_conceded },
                          { label: t('bestStreak', lang), value: s.best_win_streak },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-xl bg-muted/50 p-2 text-center">
                            <p className="score-font text-lg font-bold text-foreground">{value}</p>
                            <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent Matches */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-foreground">{t('recentMatches', lang)}</h2>
            {matchesLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : matches.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">{t('noMatches', lang)}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {matches.map(m => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm">
                    <div className="flex-1 text-right">
                      <p className={`text-sm font-semibold ${m.winner_id === m.player1_id ? 'text-primary' : 'text-card-foreground'}`}>
                        {m.player1_name}
                      </p>
                    </div>
                    <div className="score-font text-base font-bold text-foreground">
                      {m.player1_score} - {m.player2_score}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${m.winner_id === m.player2_id ? 'text-primary' : 'text-card-foreground'}`}>
                        {m.player2_name}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {m.completed_at ? new Date(m.completed_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
