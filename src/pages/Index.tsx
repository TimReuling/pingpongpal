import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppStore';
import { usePlayers } from '@/hooks/usePlayers';
import { useMatchRequests, type MatchRequest } from '@/hooks/useMatchRequests';
import { usePlayerStats } from '@/hooks/usePlayerStats';
import { useActiveMatch } from '@/hooks/useActiveMatch';
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
  const { incoming, outgoing, sendRequest, respondToRequest } = useMatchRequests(profile?.id);
  const { stats } = usePlayerStats();
  const { activeMatchId, activeOpponentId, recheck: recheckActive, clearActiveMatch } = useActiveMatch(profile?.id);
  const [page, setPage] = useState<Page>('select');
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<Tables<'profiles'> | null>(null);

  const openSharedMatch = useCallback(async (matchId: string, opponentId: string | null) => {
    if (!opponentId) return;

    let nextOpponent = players.find((player) => player.id === opponentId) ?? null;

    if (!nextOpponent) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', opponentId)
        .maybeSingle();

      nextOpponent = data ?? null;
    }

    if (!nextOpponent) return;

    setOpponent(nextOpponent);
    setCurrentMatchId(matchId);
    setPage('match');
  }, [players]);

  // Auto-resume active match on load or when one appears via realtime
  useEffect(() => {
    if (!activeMatchId || !activeOpponentId) return;
    if (page === 'match' && currentMatchId === activeMatchId) return;

    void openSharedMatch(activeMatchId, activeOpponentId);
  }, [activeMatchId, activeOpponentId, currentMatchId, openSharedMatch, page]);

  // Watch outgoing accepted requests to auto-navigate challenger into match
  useEffect(() => {
    const accepted = outgoing.find((request) => request.status === 'accepted' && request.match_id);
    if (!accepted || currentMatchId === accepted.match_id) return;

    const validateAndOpen = async () => {
      const { data } = await supabase
        .from('matches')
        .select('id, status, completed_at')
        .eq('id', accepted.match_id!)
        .maybeSingle();

      if (data?.status !== 'active' || data.completed_at) return;

      await openSharedMatch(accepted.match_id!, accepted.to_profile_id);
    };

    void validateAndOpen();
  }, [outgoing, currentMatchId, openSharedMatch]);

  const handleSelectOpponent = useCallback(async (player: Tables<'profiles'>) => {
    // For guests, create match directly
    const { data } = await supabase
      .from('matches')
      .insert({ player1_id: profile!.id, player2_id: player.id, target_score: settings.targetScore, status: 'active' })
      .select('id')
      .single();
    if (data) {
      setOpponent(player);
      setCurrentMatchId(data.id);
      setPage('match');
    }
  }, [profile, settings.targetScore]);

  const handleNewMatch = useCallback(() => {
    clearActiveMatch();
    setOpponent(null);
    setCurrentMatchId(null);
    setPage('select');
    recheckActive();
  }, [clearActiveMatch, recheckActive]);

  const handleSendChallenge = useCallback(async (player: Tables<'profiles'>) => {
    await sendRequest(player.id, settings.targetScore);
    toast.success(t('challengeSent', settings.language));
  }, [sendRequest, settings.targetScore, settings.language]);

  const handleAcceptRequest = useCallback(async (request: MatchRequest) => {
    const matchId = await respondToRequest(request.id, true);
    if (matchId) {
      await openSharedMatch(matchId, request.from_profile_id);
      void recheckActive();
    }
  }, [respondToRequest, openSharedMatch, recheckActive]);

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
    return <StatsPage lang={settings.language} onBack={() => setPage(currentMatchId ? 'match' : 'select')} />;
  }

  if (page === 'settings') {
    return (
      <SettingsPage
        lang={settings.language}
        targetScore={settings.targetScore}
        soundEnabled={settings.soundEnabled}
        darkMode={settings.darkMode}
        onUpdateSetting={(k, v) => updateSetting(k as any, v)}
        onBack={() => setPage(currentMatchId ? 'match' : 'select')}
        onSignOut={signOut}
        players={players}
        currentUserId={user.id}
        onDeleteGuest={deleteGuest}
      />
    );
  }

  if (page === 'match' && opponent && currentMatchId) {
    return (
      <ScoreBoard
        player1={profile}
        player2={opponent}
        matchId={currentMatchId}
        lang={settings.language}
        soundEnabled={settings.soundEnabled}
        onNavigate={setPage}
        onNewMatch={handleNewMatch}
        onMatchComplete={() => {}}
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
