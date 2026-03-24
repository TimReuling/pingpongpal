import { describe, expect, it } from 'vitest';
import { getOpponentId, hasValidSessionPlayers, isActiveSession, resolveSessionPlayers } from '@/lib/matchSession';

describe('match session helpers', () => {
  it('keeps player-one and player-two mapping stable', () => {
    const players = [
      { id: 'b', name: 'Player B' },
      { id: 'a', name: 'Player A' },
    ];

    const resolved = resolveSessionPlayers(players, 'a', 'b');

    expect(resolved.playerOne?.id).toBe('a');
    expect(resolved.playerTwo?.id).toBe('b');
  });

  it('only restores truly active sessions', () => {
    expect(isActiveSession({ status: 'active', completedAt: null })).toBe(true);
    expect(isActiveSession({ status: 'finished', completedAt: '2026-03-24T10:00:00Z' })).toBe(false);
  });

  it('validates both player ids and resolves the opponent id', () => {
    expect(hasValidSessionPlayers({ player1Id: 'a', player2Id: 'b' })).toBe(true);
    expect(hasValidSessionPlayers({ player1Id: 'a', player2Id: 'a' })).toBe(false);
    expect(getOpponentId({ player1Id: 'a', player2Id: 'b' }, 'a')).toBe('b');
  });
});