import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppStore';
import { usePlayers } from '@/hooks/usePlayers';
import { useMatchRequests, type MatchRequest } from '@/hooks/useMatchRequests';
import { usePlayerStats } from '@/hooks/usePlayerStats';
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
  const [page, setPage] = useState<Page>('select');
  const [opponent, setOpponent] = useState<Tables<'profiles'> | null>(null);

  const handleSelectOpponent = useCallback((player: Tables<'profiles'>) => {
    setOpponent(player);
    setPage('match');
  }, []);

  const handleNewMatch = useCallback(() => {
    setOpponent(null);
    setPage('select');
  }, []);

  const handleSendChallenge = useCallback(async (player: Tables<'profiles'>) => {
    await sendRequest(player.id, settings.targetScore);
    toast.success(t('challengeSent', settings.language));
  }, [sendRequest, settings.targetScore, settings.language]);

  const handleAcceptRequest = useCallback(async (request: MatchRequest) => {
    await respondToRequest(request.id, true);
    // Find the challenger profile from players list
    const challenger = players.find(p => p.id === request.from_profile_id);
    if (challenger) {
      handleSelectOpponent(challenger);
    }
  }, [respondToRequest, players, handleSelectOpponent]);

  const handleDeclineRequest = useCallback(async (requestId: string) => {
    await respondToRequest(requestId, false);
  }, [respondToRequest]);

  // Placeholder for future: auto-navigate when outgoing request is accepted
  void outgoing;

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
    return <StatsPage lang={settings.language} onBack={() => setPage(opponent ? 'match' : 'select')} />;
  }

  if (page === 'settings') {
    return (
      <SettingsPage
        lang={settings.language}
        targetScore={settings.targetScore}
        soundEnabled={settings.soundEnabled}
        darkMode={settings.darkMode}
        onUpdateSetting={(k, v) => updateSetting(k as any, v)}
        onBack={() => setPage(opponent ? 'match' : 'select')}
        onSignOut={signOut}
        players={players}
        currentUserId={user.id}
        onDeleteGuest={deleteGuest}
      />
    );
  }

  if (page === 'match' && opponent) {
    return (
      <ScoreBoard
        player1={profile}
        player2={opponent}
        targetScore={settings.targetScore}
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
