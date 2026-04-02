import { describe, expect, it } from 'vitest';
import { checkWinner, getInitialMatchState, updateScore } from '@/lib/scoring';

describe('scoring rules', () => {
  it('defaults to an 11-point target score', () => {
    expect(getInitialMatchState().targetScore).toBe(11);
  });

  it('requires at least 11 points and a 2-point lead to win', () => {
    expect(checkWinner(11, 0, 11)).toBe(1);
    expect(checkWinner(11, 9, 11)).toBe(1);
    expect(checkWinner(11, 10, 11)).toBeNull();
    expect(checkWinner(12, 10, 11)).toBe(1);
    expect(checkWinner(20, 18, 11)).toBe(1);
    expect(checkWinner(20, 19, 11)).toBeNull();
  });

  it('keeps the match interactive at deuce until the winner is valid', () => {
    const deuceState = {
      ...getInitialMatchState(11, 1),
      player1Score: 10,
      player2Score: 10,
    };

    const nextState = updateScore(deuceState, 1, 1, 1);

    expect(nextState.player1Score).toBe(11);
    expect(nextState.isComplete).toBe(false);
    expect(nextState.winner).toBeNull();
  });
});