import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppStore';
import { usePlayers } from '@/hooks/usePlayers';
import { useMatchRequests, type MatchRequest } from '@/hooks/useMatchRequests';
import { usePlayerStats } from '@/hooks/usePlayerStats';
import { useActiveMatch } from '@/hooks/useActiveMatch';
import { debugMatchEvent } from '@/lib/matchSession';
import LoginScreen from '@/components/LoginScreen';
import OpponentSelect from '@/components/OpponentSelect';
import ScoreBoard from '@/components/ScoreBoard';
import StatsPage from '@/components/StatsPage';
import SettingsPage from '@/components/SettingsPage';
import ProfilePage from '@/components/ProfilePage';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { t } from '@/lib/i18n';

type Page = 'select' | 'match' | 'stats' | 'settings' | 'profile';

export default function Index() {
  const { user, profile, loading, signOut, setProfile } = useAuth();
  const { settings, updateSetting } = useAppSettings();
  const { players, addGuest, deleteGuest } = usePlayers(user?.id);
  const { incoming, sendRequest, respondToRequest } = useMatchRequests(profile?.id);
  const { stats } = usePlayerStats();
  const { activeMatchId, recheck: recheckActive, clearActiveMatch } = useActiveMatch(profile?.id);
  const [page, setPage] = useState<Page>('select');
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null);
  // Tracks the match ID we most recently intentionally exited so the routing
  // effect can ignore a stale activeMatchId that arrives after the exit.
  const lastExitedMatchIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeMatchId) return;

    if (activeMatchId === lastExitedMatchIdRef.current) {
      // Stale detection: checkActiveMatch fired after we already exited this
      // match. Clear the active-match state and stay on the select screen.
      debugMatchEvent('ignored stale re-route for recently exited match', {
        matchId: activeMatchId,
        profileId: profile?.id ?? null,
      });
      clearActiveMatch();
      return;
    }

    // Arriving here means it's a genuine new active match (e.g. app restore or
    // incoming accepted challenge); clear the exit guard and route to it.
    lastExitedMatchIdRef.current = null;
    debugMatchEvent('routing into active match from authoritative session state', {
      matchId: activeMatchId,
      profileId: profile?.id ?? null,
    });
    setLiveMatchId(activeMatchId);
    setPage('match');
  }, [activeMatchId, clearActiveMatch, profile?.id]);

  const handleSelectOpponent = useCallback(async (player: Tables<'profiles'>) => {
    if (!profile) return;

    debugMatchEvent('direct match created', {
      playerOneId: profile.id,
      playerTwoId: player.id,
      targetScore: settings.targetScore,
    });

    const { data } = await supabase
      .from('matches')
      .insert({ player1_id: profile.id, player2_id: player.id, target_score: settings.targetScore, status: 'active' })
      .select('id')
      .single();

    if (data) {
      setLiveMatchId(data.id);
      setPage('match');
      void recheckActive();
    }
  }, [profile, recheckActive, settings.targetScore]);

  const handleExitMatch = useCallback(() => {
    debugMatchEvent('leaving live match screen', { matchId: liveMatchId, profileId: profile?.id ?? null });
    lastExitedMatchIdRef.current = liveMatchId;
    clearActiveMatch();
    setLiveMatchId(null);
    setPage('select');
  }, [clearActiveMatch, liveMatchId, profile?.id]);

  const handleRematch = useCallback(async (playerOneId: string, playerTwoId: string, targetScore: number) => {
    debugMatchEvent('fresh rematch created', {
      playerOneId,
      playerTwoId,
      targetScore,
    });

    const { data } = await supabase
      .from('matches')
      .insert({ player1_id: playerOneId, player2_id: playerTwoId, target_score: targetScore, status: 'active' })
      .select('id')
      .single();

    if (data) {
      setLiveMatchId(data.id);
      setPage('match');
      void recheckActive();
    }
  }, [recheckActive]);

  const handleSendChallenge = useCallback(async (player: Tables<'profiles'>) => {
    await sendRequest(player.id, settings.targetScore);
    toast.success(t('challengeSent', settings.language));
  }, [sendRequest, settings.targetScore, settings.language]);

  const handleAcceptRequest = useCallback(async (request: MatchRequest) => {
    debugMatchEvent('challenge accepted', { requestId: request.id, profileId: profile?.id ?? null });
    const matchId = await respondToRequest(request.id, true);
    if (matchId) {
      setLiveMatchId(matchId);
      setPage('match');
      void recheckActive();
    }
  }, [profile?.id, recheckActive, respondToRequest]);

  const handleDeclineRequest = useCallback(async (requestId: string) => {
    await respondToRequest(requestId, false);
  }, [respondToRequest]);

  const myStats = stats.find(s => s.profile_id === profile?.id) ?? null;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-table-green-dark">
        <div className="text-2xl font-bold text-primary-foreground">🏓</div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginScreen lang={settings.language} />;
  }

  if (page === 'profile') {
    return (
      <ProfilePage
        profile={profile}
        stats={myStats}
        lang={settings.language}
        onBack={() => setPage('select')}
        onProfileUpdated={setProfile}
      />
    );
  }

  if (page === 'stats') {
    return <StatsPage lang={settings.language} onBack={() => setPage(liveMatchId ? 'match' : 'select')} />;
  }

  if (page === 'settings') {
    return (
      <SettingsPage
        lang={settings.language}
        targetScore={settings.targetScore}
        soundEnabled={settings.soundEnabled}
        darkMode={settings.darkMode}
        onUpdateSetting={(k, v) => updateSetting(k as any, v)}
        onBack={() => setPage(liveMatchId ? 'match' : 'select')}
        onSignOut={signOut}
        players={players}
        currentUserId={user.id}
        onDeleteGuest={deleteGuest}
      />
    );
  }

  if (page === 'match' && liveMatchId && profile) {
    return (
      <ScoreBoard
        key={liveMatchId}
        matchId={liveMatchId}
        currentProfileId={profile.id}
        lang={settings.language}
        soundEnabled={settings.soundEnabled}
        onExit={handleExitMatch}
        onRematch={handleRematch}
      />
    );
  }

  return (
    <OpponentSelect
      players={players}
      currentProfileId={profile.id}
      onSelect={handleSelectOpponent}
      onAddGuest={addGuest}
      lang={settings.language}
      onNavigate={(p) => setPage(p as Page)}
      incomingRequests={incoming}
      onAcceptRequest={handleAcceptRequest}
      onDeclineRequest={handleDeclineRequest}
      onSendChallenge={handleSendChallenge}
      currentProfile={profile}
    />
  );
}
