import { useState } from 'react';
import { useStatsData } from '@/hooks/useStatsData';
import { useDeletionRequests } from '@/hooks/useDeletionRequests';
import { t, type Lang } from '@/lib/i18n';
import TimeFilterBar from '@/components/stats/TimeFilterBar';
import InsightCards from '@/components/stats/InsightCards';
import PerformanceCharts from '@/components/stats/PerformanceCharts';
import PlayerLeaderboard from '@/components/stats/PlayerLeaderboard';
import PlayerComparison from '@/components/stats/PlayerComparison';
import MatchHistory from '@/components/stats/MatchHistory';

type Tab = 'overview' | 'charts' | 'compare' | 'history';

interface StatsPageProps {
  lang: Lang;
  currentProfileId: string;
  onBack: () => void;
  onOpenPendingDeletions: () => void;
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'charts', label: 'Charts' },
  { key: 'compare', label: 'Compare' },
  { key: 'history', label: 'History' },
];

export default function StatsPage({ lang, currentProfileId, onBack, onOpenPendingDeletions }: StatsPageProps) {
  const {
    matches, profiles, loading, timeFilter, setTimeFilter,
    insights, getHeadToHead, deletePlayerMatches, resetAllStats,
  } = useStatsData();
  const { incoming, outgoing, requestDeletion } = useDeletionRequests(currentProfileId);
  const outgoingMatchIds = new Set(outgoing.map(r => r.match_id));
  const incomingMatchIds = new Set(incoming.map(r => r.match_id));
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <div className="safe-top flex items-center gap-3 bg-table-green-dark px-4 py-5">
        <button onClick={onBack} className="rounded-xl bg-primary-foreground/10 px-3 py-2 text-primary-foreground font-semibold active:scale-95">
          ← {t('back', lang)}
        </button>
        <h1 className="text-xl font-bold text-primary-foreground">{t('stats', lang)}</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-card/50 px-4 py-2 border-b border-border/50">
        {tabs.map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              tab === tb.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-lg flex flex-col gap-4">
          {/* Time filter (not on history tab) */}
          {tab !== 'history' && (
            <TimeFilterBar value={timeFilter} onChange={setTimeFilter} />
          )}

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading...</div>
          ) : (
            <>
              {tab === 'overview' && (
                <>
                  <InsightCards insights={insights} />
                  <section>
                    <h2 className="mb-3 text-lg font-bold text-foreground">{t('leaderboard', lang)}</h2>
                    <PlayerLeaderboard insights={insights} />
                  </section>
                </>
              )}

              {tab === 'charts' && (
                <PerformanceCharts matches={matches} profiles={profiles} />
              )}

              {tab === 'compare' && (
                <section>
                  <h2 className="mb-3 text-lg font-bold text-foreground">Player Comparison</h2>
                  <PlayerComparison insights={insights} profiles={profiles} getHeadToHead={getHeadToHead} />
                </section>
              )}

              {tab === 'history' && (
                <section>
                  <h2 className="mb-3 text-lg font-bold text-foreground">Match History</h2>
                  <MatchHistory
                    matches={matches}
                    profiles={profiles}
                    currentProfileId={currentProfileId}
                    outgoingMatchIds={outgoingMatchIds}
                    incomingMatchIds={incomingMatchIds}
                    onRequestDeletion={requestDeletion}
                    onDeletePlayerMatches={deletePlayerMatches}
                    onResetAll={resetAllStats}
                    onOpenPendingDeletions={onOpenPendingDeletions}
                  />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
