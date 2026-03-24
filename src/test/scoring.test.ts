import { describe, expect, it } from 'vitest';
import { checkWinner, getInitialMatchState, updateScore } from '@/lib/scoring';

describe('scoring rules', () => {
  it('defaults to a 10-point target score', () => {
    expect(getInitialMatchState().targetScore).toBe(10);
  });

  it('requires a 2-point lead after 10-10', () => {
    expect(checkWinner(10, 10, 10)).toBeNull();
    expect(checkWinner(11, 10, 10)).toBeNull();
    expect(checkWinner(12, 10, 10)).toBe(1);
  });

  it('keeps the match interactive at deuce until the winner is valid', () => {
    const deuceState = {
      ...getInitialMatchState(10, 1),
      player1Score: 10,
      player2Score: 10,
    };

    const nextState = updateScore(deuceState, 1, 1, 1);

    expect(nextState.player1Score).toBe(11);
    expect(nextState.isComplete).toBe(false);
    expect(nextState.winner).toBeNull();
  });
});