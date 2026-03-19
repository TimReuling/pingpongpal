import { useState } from 'react';
import type { Tables } from '@/integrations/supabase/types';
import { t, type Lang } from '@/lib/i18n';

interface OpponentSelectProps {
  players: Tables<'profiles'>[];
  currentProfileId: string;
  onSelect: (player: Tables<'profiles'>) => void;
  onAddGuest: (name: string) => Promise<Tables<'profiles'> | null>;
  lang: Lang;
}

export default function OpponentSelect({ players, currentProfileId, onSelect, onAddGuest, lang }: OpponentSelectProps) {
  const [guestName, setGuestName] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);

  const opponents = players.filter(p => p.id !== currentProfileId);

  const handleAddGuest = async () => {
    if (!guestName.trim()) return;
    const guest = await onAddGuest(guestName.trim());
    if (guest) onSelect(guest);
    setGuestName('');
    setShowGuestInput(false);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-center bg-table-green-dark px-4 py-6">
        <h1 className="text-2xl font-bold text-primary-foreground">
          {t('selectOpponent', lang)}
        </h1>
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          {opponents.map(player => (
            <button
              key={player.id}
              onClick={() => onSelect(player)}
              className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm transition-all active:scale-[0.98] hover:shadow-md"
            >
              {player.avatar_url ? (
                <img
                  src={player.avatar_url}
                  alt={player.display_name}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                  {player.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-lg font-semibold text-card-foreground">
                {player.display_name}
              </span>
              {player.is_guest && (
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Guest
                </span>
              )}
            </button>
          ))}

          {opponents.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">{t('noPlayers', lang)}</p>
          )}

          {/* Divider */}
          <div className="my-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm text-muted-foreground">{t('or', lang)}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Add guest */}
          {showGuestInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t('guestName', lang)}
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddGuest()}
                className="flex-1 rounded-xl border border-input bg-card px-4 py-3 text-card-foreground outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <button
                onClick={handleAddGuest}
                className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground active:scale-95"
              >
                {t('add', lang)}
              </button>
              <button
                onClick={() => { setShowGuestInput(false); setGuestName(''); }}
                className="rounded-xl bg-muted px-4 py-3 font-medium text-muted-foreground active:scale-95"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowGuestInput(true)}
              className="rounded-2xl border-2 border-dashed border-border bg-card/50 py-4 font-semibold text-muted-foreground transition-all active:scale-[0.98] hover:border-primary hover:text-primary"
            >
              + {t('addGuest', lang)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
