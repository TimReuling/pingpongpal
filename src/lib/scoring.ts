export interface MatchState {
  player1Score: number;
  player2Score: number;
  targetScore: number;
  server: 1 | 2; // which player is serving
  isComplete: boolean;
  winner: 1 | 2 | null;
}

export function getInitialMatchState(targetScore: number = 11, firstServer: 1 | 2 = 1): MatchState {
  return {
    player1Score: 0,
    player2Score: 0,
    targetScore,
    server: firstServer,
    isComplete: false,
    winner: null,
  };
}

export function calculateServer(
  p1Score: number,
  p2Score: number,
  targetScore: number,
  firstServer: 1 | 2
): 1 | 2 {
  const totalPoints = p1Score + p2Score;
  const isDeuce = p1Score >= targetScore - 1 && p2Score >= targetScore - 1;

  if (isDeuce) {
    // In deuce, service changes every point
    const deucePoints = totalPoints - (targetScore - 1) * 2;
    return deucePoints % 2 === 0 ? firstServer : (firstServer === 1 ? 2 : 1);
  }

  // Normal play: service changes every 2 points
  const serviceBlock = Math.floor(totalPoints / 2);
  return serviceBlock % 2 === 0 ? firstServer : (firstServer === 1 ? 2 : 1);
}

export function checkWinner(
  p1Score: number,
  p2Score: number,
  targetScore: number
): 1 | 2 | null {
  if (p1Score >= targetScore && p1Score - p2Score >= 2) return 1;
  if (p2Score >= targetScore && p2Score - p1Score >= 2) return 2;
  return null;
}

export function updateScore(
  state: MatchState,
  player: 1 | 2,
  delta: 1 | -1,
  firstServer: 1 | 2
): MatchState {
  if (state.isComplete && delta === 1) return state;

  const newP1 = player === 1 ? Math.max(0, state.player1Score + delta) : state.player1Score;
  const newP2 = player === 2 ? Math.max(0, state.player2Score + delta) : state.player2Score;

  const winner = checkWinner(newP1, newP2, state.targetScore);
  const server = calculateServer(newP1, newP2, state.targetScore, firstServer);

  return {
    ...state,
    player1Score: newP1,
    player2Score: newP2,
    server,
    isComplete: winner !== null,
    winner,
  };
}
