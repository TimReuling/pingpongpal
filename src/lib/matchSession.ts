export function hasValidSessionPlayers(match: {
  player1Id: string | null | undefined;
  player2Id: string | null | undefined;
}) {
  return Boolean(match.player1Id && match.player2Id && match.player1Id !== match.player2Id);
}

export function isActiveSession(match: {
  status: string | null | undefined;
  completedAt: string | null | undefined;
}) {
  return match.status === 'active' && !match.completedAt;
}

export function getOpponentId(match: {
  player1Id: string;
  player2Id: string;
}, profileId: string) {
  if (match.player1Id === profileId) return match.player2Id;
  if (match.player2Id === profileId) return match.player1Id;
  return null;
}

export function resolveSessionPlayers<T extends { id: string }>(
  participants: T[],
  player1Id: string,
  player2Id: string,
) {
  return {
    playerOne: participants.find((participant) => participant.id === player1Id) ?? null,
    playerTwo: participants.find((participant) => participant.id === player2Id) ?? null,
  };
}