import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { t, type Lang } from '@/lib/i18n';
import type { PlayerStatWithName } from '@/hooks/usePlayerStats';

interface ProfilePageProps {
  profile: Tables<'profiles'>;
  stats: PlayerStatWithName | null;
  lang: Lang;
  onBack: () => void;
  onProfileUpdated: (profile: Tables<'profiles'>) => void;
}

export default function ProfilePage({ profile, stats, lang, onBack, onProfileUpdated }: ProfilePageProps) {
  const [nickname, setNickname] = useState(profile.display_name);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${profile.id}/avatar.${ext}`;

    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = data.publicUrl + '?t=' + Date.now();
      setAvatarUrl(url);
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { data } = await supabase
      .from('profiles')
      .update({ display_name: nickname.trim(), avatar_url: avatarUrl })
      .eq('id', profile.id)
      .select()
      .single();

    if (data) {
      onProfileUpdated(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const winRate = stats && stats.matches_played > 0
    ? Math.round((stats.matches_won / stats.matches_played) * 100)
    : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="safe-top flex items-center gap-3 bg-table-green-dark px-4 py-5">
        <button onClick={onBack} className="rounded-xl bg-primary-foreground/10 px-3 py-2 text-primary-foreground font-semibold active:scale-95">
          ← {t('back', lang)}
        </button>
        <h1 className="text-xl font-bold text-primary-foreground">{t('profile', lang)}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-md flex flex-col gap-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="relative group"
              disabled={uploading}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover border-4 border-primary/20" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-4xl font-bold text-primary border-4 border-primary/20">
                  {nickname.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-sm font-bold text-primary-foreground">📷</span>
              </div>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/50">
                  <div className="h-6 w-6 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-sm font-medium text-primary active:scale-95"
            >
              {t('changeAvatar', lang)}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          {/* Nickname */}
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <label className="mb-2 block text-sm font-semibold text-card-foreground">
              {t('nickname', lang)}
            </label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
              maxLength={30}
            />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !nickname.trim()}
            className="rounded-2xl bg-primary py-4 font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
          >
            {saved ? `✓ ${t('profileSaved', lang)}` : saving ? '...' : t('save', lang)}
          </button>

          {/* Stats */}
          {stats && (
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <h3 className="mb-3 font-bold text-card-foreground">{t('stats', lang)}</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t('matchesPlayed', lang), value: stats.matches_played },
                  { label: t('matchesWon', lang), value: stats.matches_won },
                  { label: t('matchesLost', lang), value: stats.matches_lost },
                  { label: t('winRate', lang), value: `${winRate}%` },
                  { label: t('pointsScored', lang), value: stats.total_points_scored },
                  { label: t('pointsConceded', lang), value: stats.total_points_conceded },
                  { label: t('winStreak', lang), value: stats.current_win_streak },
                  { label: t('bestStreak', lang), value: stats.best_win_streak },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-muted/50 p-3 text-center">
                    <p className="score-font text-xl font-bold text-foreground">{value}</p>
                    <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
