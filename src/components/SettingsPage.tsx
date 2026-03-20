import { useState } from 'react';
import { t, type Lang } from '@/lib/i18n';
import type { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

interface SettingsPageProps {
  lang: Lang;
  targetScore: number;
  soundEnabled: boolean;
  darkMode: boolean;
  onUpdateSetting: (key: string, value: any) => void;
  onBack: () => void;
  onSignOut: () => void;
  players: Tables<'profiles'>[];
  currentUserId: string | undefined;
  onDeleteGuest: (id: string) => void;
}

export default function SettingsPage({
  lang, targetScore, soundEnabled, darkMode,
  onUpdateSetting, onBack, onSignOut, players, currentUserId, onDeleteGuest
}: SettingsPageProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  const handleResetAllStats = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    // Reset all stats for current user's players
    for (const p of players) {
      if (p.user_id === currentUserId || (p.is_guest && p.created_by === currentUserId)) {
        await supabase.from('player_stats').update({
          matches_played: 0, matches_won: 0, matches_lost: 0,
          total_points_scored: 0, total_points_conceded: 0,
          current_win_streak: 0, best_win_streak: 0,
        }).eq('profile_id', p.id);
      }
    }
    setConfirmReset(false);
  };

  const guests = players.filter(p => p.is_guest && p.created_by === currentUserId);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="safe-top flex items-center gap-3 bg-table-green-dark px-4 py-5">
        <button onClick={onBack} className="rounded-xl bg-primary-foreground/10 px-3 py-2 text-primary-foreground font-semibold active:scale-95">
          ← {t('back', lang)}
        </button>
        <h1 className="text-xl font-bold text-primary-foreground">{t('settings', lang)}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-md flex flex-col gap-4">
          {/* Target Score */}
          <SettingRow label={t('targetScore', lang)}>
            <div className="flex items-center gap-3">
              {[7, 11, 15, 21].map(s => (
                <button
                  key={s}
                  onClick={() => onUpdateSetting('targetScore', s)}
                  className={`rounded-xl px-4 py-2 font-bold transition-all active:scale-95 ${
                    targetScore === s
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </SettingRow>

          {/* Sound */}
          <SettingRow label={t('soundEffects', lang)}>
            <ToggleSwitch
              checked={soundEnabled}
              onChange={v => onUpdateSetting('soundEnabled', v)}
            />
          </SettingRow>

          {/* Dark mode */}
          <SettingRow label={t('darkMode', lang)}>
            <ToggleSwitch
              checked={darkMode}
              onChange={v => onUpdateSetting('darkMode', v)}
            />
          </SettingRow>

          {/* Language */}
          <SettingRow label={t('language', lang)}>
            <div className="flex gap-2">
              {(['en', 'nl'] as Lang[]).map(l => (
                <button
                  key={l}
                  onClick={() => onUpdateSetting('language', l)}
                  className={`rounded-xl px-4 py-2 font-bold transition-all active:scale-95 ${
                    lang === l
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {l === 'en' ? '🇬🇧 EN' : '🇳🇱 NL'}
                </button>
              ))}
            </div>
          </SettingRow>

          {/* Manage guests */}
          {guests.length > 0 && (
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <h3 className="mb-3 font-bold text-card-foreground">{t('managePlayers', lang)}</h3>
              <div className="flex flex-col gap-2">
                {guests.map(g => (
                  <div key={g.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                    <span className="font-medium text-foreground">{g.display_name}</span>
                    <button
                      onClick={() => onDeleteGuest(g.id)}
                      className="rounded-lg bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive active:scale-95"
                    >
                      {t('delete', lang)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset all stats */}
          <button
            onClick={handleResetAllStats}
            className={`rounded-2xl py-4 font-bold transition-all active:scale-95 ${
              confirmReset
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {confirmReset ? t('confirmReset', lang) : t('resetAllStats', lang)}
          </button>

          {/* Sign out */}
          <button
            onClick={onSignOut}
            className="rounded-2xl bg-muted py-4 font-bold text-muted-foreground transition-all active:scale-95"
          >
            {t('signOut', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-sm">
      <span className="font-semibold text-card-foreground">{label}</span>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 rounded-full transition-colors duration-200 ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <div
        className={`absolute top-1 h-6 w-6 rounded-full bg-card shadow transition-transform duration-200 ${
          checked ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
