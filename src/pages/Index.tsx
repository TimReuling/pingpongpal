import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppSettings } from '@/hooks/useAppStore';
import { usePlayers } from '@/hooks/usePlayers';
import LoginScreen from '@/components/LoginScreen';
import OpponentSelect from '@/components/OpponentSelect';
import ScoreBoard from '@/components/ScoreBoard';
import StatsPage from '@/components/StatsPage';
import SettingsPage from '@/components/SettingsPage';
import type { Tables } from '@/integrations/supabase/types';

type Page = 'select' | 'match' | 'stats' | 'settings';

export default function Index() {
  const { user, profile, loading, signOut } = useAuth();
  const { settings, updateSetting } = useAppSettings();
  const { players, addGuest, deleteGuest } = usePlayers(user?.id);
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
    />
  );
}
