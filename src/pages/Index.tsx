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
  const { activeMatchId, activeOpponentId, recheck: recheckActive } = useActiveMatch(profile?.id);
  const [page, setPage] = useState<Page>('select');
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<Tables<'profiles'> | null>(null);

  // Auto-resume active match on load or when one appears via realtime
  useEffect(() => {
    if (activeMatchId && page === 'select') {
      const opp = players.find(p => p.id === activeOpponentId);
      if (opp) {
        setOpponent(opp);
        setCurrentMatchId(activeMatchId);
        setPage('match');
      }
    }
  }, [activeMatchId, activeOpponentId, players, page]);

  // Watch outgoing accepted requests to auto-navigate challenger into match
  useEffect(() => {
    const accepted = outgoing.find(r => r.status === 'accepted' && r.match_id);
    if (accepted && page === 'select') {
      const opp = players.find(p => p.id === accepted.to_profile_id);
      if (opp) {
        setOpponent(opp);
        setCurrentMatchId(accepted.match_id!);
        setPage('match');
      }
    }
  }, [outgoing, players, page]);

  const handleSelectOpponent = useCallback(async (player: Tables<'profiles'>) => {
    // For guests, create match directly
    const { data } = await (await import('@/integrations/supabase/client')).supabase
      .from('matches')
      .insert({ player1_id: profile!.id, player2_id: player.id, target_score: settings.targetScore })
      .select('id')
      .single();
    if (data) {
      setOpponent(player);
      setCurrentMatchId(data.id);
      setPage('match');
    }
  }, [profile, settings.targetScore]);

  const handleNewMatch = useCallback(() => {
    setOpponent(null);
    setCurrentMatchId(null);
    setPage('select');
    recheckActive();
  }, [recheckActive]);

  const handleSendChallenge = useCallback(async (player: Tables<'profiles'>) => {
    await sendRequest(player.id, settings.targetScore);
    toast.success(t('challengeSent', settings.language));
  }, [sendRequest, settings.targetScore, settings.language]);

  const handleAcceptRequest = useCallback(async (request: MatchRequest) => {
    const matchId = await respondToRequest(request.id, true);
    if (matchId) {
      const challenger = players.find(p => p.id === request.from_profile_id);
      if (challenger) {
        setOpponent(challenger);
        setCurrentMatchId(matchId);
        setPage('match');
      }
    }
  }, [respondToRequest, players]);

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
