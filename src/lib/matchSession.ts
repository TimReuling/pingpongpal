export function hasValidSessionPlayers(match: {
  player1Id: string | null | undefined;
  player2Id: string | null | undefined;
}) {
  return Boolean(match.player1Id && match.player2Id && match.player1Id !== match.player2Id);
}

export function hasValidScoreState(match: {
  player1Score: number | null | undefined;
  player2Score: number | null | undefined;
}) {
  return Number.isInteger(match.player1Score)
    && Number.isInteger(match.player2Score)
    && (match.player1Score ?? -1) >= 0
    && (match.player2Score ?? -1) >= 0;
}

export function normalizeSessionStatus(status: string | null | undefined) {
  if (!status) return null;
  return status === 'finished' ? 'completed' : status;
}

export function isActiveSession(match: {
  status: string | null | undefined;
  completedAt: string | null | undefined;
}) {
  return normalizeSessionStatus(match.status) === 'active' && !match.completedAt;
}

export function isInteractiveSession(match: {
  status: string | null | undefined;
  completedAt: string | null | undefined;
}) {
  return normalizeSessionStatus(match.status) === 'active' && !match.completedAt;
}

export function isCompletedSession(match: {
  status: string | null | undefined;
}) {
  return normalizeSessionStatus(match.status) === 'completed';
}

export function isTerminalSession(match: {
  status: string | null | undefined;
}) {
  const normalizedStatus = normalizeSessionStatus(match.status);
  return normalizedStatus === 'completed'
    || normalizedStatus === 'cancelled'
    || normalizedStatus === 'abandoned';
}

export function canRestoreSession(match: {
  player1Id: string | null | undefined;
  player2Id: string | null | undefined;
  status: string | null | undefined;
  completedAt: string | null | undefined;
  winnerId?: string | null | undefined;
  player1Score: number | null | undefined;
  player2Score: number | null | undefined;
}) {
  const normalizedStatus = normalizeSessionStatus(match.status);

  return hasValidSessionPlayers(match)
    && hasValidScoreState({
      player1Score: match.player1Score,
      player2Score: match.player2Score,
    })
    && (normalizedStatus === 'active' || normalizedStatus === 'cancel_requested')
    && !match.completedAt
    && !match.winnerId;
}

export function debugMatchEvent(event: string, payload?: unknown) {
  console.debug(`[match] ${event}`, payload);
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