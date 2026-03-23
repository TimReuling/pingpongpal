import { useState } from 'react';
import type { Tables } from '@/integrations/supabase/types';
import { t, type Lang } from '@/lib/i18n';
import type { MatchRequest } from '@/hooks/useMatchRequests';
import MatchRequestNotification from './MatchRequestNotification';

interface OpponentSelectProps {
  players: Tables<'profiles'>[];
  currentProfileId: string;
  onSelect: (player: Tables<'profiles'>) => void;
  onAddGuest: (name: string) => Promise<Tables<'profiles'> | null>;
  lang: Lang;
  onNavigate: (page: string) => void;
  incomingRequests: MatchRequest[];
  onAcceptRequest: (request: MatchRequest) => void;
  onDeclineRequest: (requestId: string) => void;
  onSendChallenge: (player: Tables<'profiles'>) => void;
  currentProfile: Tables<'profiles'> | null;
}

export default function OpponentSelect({
  players, currentProfileId, onSelect, onAddGuest, lang,
  onNavigate, incomingRequests, onAcceptRequest, onDeclineRequest,
  onSendChallenge, currentProfile,
}: OpponentSelectProps) {
  const [guestName, setGuestName] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [search, setSearch] = useState('');

  const opponents = players.filter(p => p.id !== currentProfileId);
  const filtered = search.trim()
    ? opponents.filter(p => p.display_name.toLowerCase().includes(search.toLowerCase()))
    : opponents;

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
      <div className="safe-top flex items-center justify-between bg-table-green-dark px-4 py-6">
        <h1 className="text-2xl font-bold text-primary-foreground">
          {t('selectOpponent', lang)}
        </h1>
        <div className="flex gap-2">
          {currentProfile && (
            <button
              onClick={() => onNavigate('profile')}
              className="flex items-center gap-2 rounded-xl bg-primary-foreground/10 px-3 py-2 active:scale-95"
            >
              {currentProfile.avatar_url ? (
                <img src={currentProfile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/20 text-sm font-bold text-primary-foreground">
                  {currentProfile.display_name.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
          )}
          <button
            onClick={() => onNavigate('stats')}
            className="rounded-xl bg-primary-foreground/10 px-3 py-2 text-sm font-semibold text-primary-foreground active:scale-95"
          >
            📊
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className="rounded-xl bg-primary-foreground/10 px-3 py-2 text-sm font-semibold text-primary-foreground active:scale-95"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          {/* Incoming match requests */}
          <MatchRequestNotification
            requests={incomingRequests}
            lang={lang}
            onAccept={onAcceptRequest}
            onDecline={onDeclineRequest}
          />

          {/* Player list */}
          {opponents.map(player => (
            <div
              key={player.id}
              className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm transition-all"
            >
              <button
                onClick={() => player.is_guest ? onSelect(player) : onSendChallenge(player)}
                className="flex flex-1 items-center gap-4 active:scale-[0.98]"
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
                <div className="flex-1 text-left">
                  <span className="text-lg font-semibold text-card-foreground">
                    {player.display_name}
                  </span>
                  {player.is_guest && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Guest
                    </span>
                  )}
                </div>
              </button>
              {player.is_guest ? (
                <button
                  onClick={() => onSelect(player)}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground active:scale-95"
                >
                  {t('startDirectly', lang)}
                </button>
              ) : (
                <button
                  onClick={() => onSendChallenge(player)}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground active:scale-95"
                >
                  {t('challenge', lang)}
                </button>
              )}
            </div>
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
