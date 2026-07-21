import {
  assertCurrentAuthGeneration,
  clearStoredAuth,
  ensureAccessToken,
  getAuthGeneration,
  refreshAccessToken,
} from '@/lib/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

export class GameStatsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GameStatsApiError';
  }
}

export interface PubgConnectionResponse {
  connected: boolean;
  playerName: string;
}

export type GameName = 'PUBG' | 'R6';
export type StatsMode = 'RANKED' | 'NORMAL';

const GAME_STATS_DISCONNECT_PATH: Record<GameName, string> = {
  PUBG: '/api/v1/pubg/disconnect',
  R6: '/api/v1/r6/disconnect',
};

export interface GameStatsSummaryResponse {
  game: GameName;
  connected: boolean;
  playerName: string | null;
  tierLabel: string | null;
  kd: number | null;
  winRate: number | null;
  matches: number | null;
  statsMode: StatsMode | null;
}

export interface PubgSummaryResponse extends GameStatsSummaryResponse {
  game: 'PUBG';
}

export interface R6ConnectionResponse {
  connected: boolean;
  playerName: string;
  platform: 'PC';
}

export interface R6SummaryResponse extends GameStatsSummaryResponse {
  game: 'R6';
  platform: 'PC';
  updatedAt: string | null;
}

async function gameStatsRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (accessToken: string) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    return { response, payload };
  };

  const requestGeneration = getAuthGeneration();
  let accessToken = await ensureAccessToken(requestGeneration);
  assertCurrentAuthGeneration(requestGeneration);

  if (!accessToken) {
    throw new GameStatsApiError(401, '로그인이 필요하거나 인증이 만료되었습니다.');
  }

  let result = await send(accessToken);
  assertCurrentAuthGeneration(requestGeneration);

  if (result.response.status === 401) {
    accessToken = await refreshAccessToken(requestGeneration);
    assertCurrentAuthGeneration(requestGeneration);

    if (!accessToken) {
      throw new GameStatsApiError(401, '로그인이 필요하거나 인증이 만료되었습니다.');
    }

    result = await send(accessToken);
    assertCurrentAuthGeneration(requestGeneration);
  }

  if (!result.response.ok) {
    if (result.response.status === 401) {
      clearStoredAuth();
    }

    throw new GameStatsApiError(
      result.response.status,
      result.payload?.message ?? '게임 전적 요청에 실패했습니다.',
    );
  }

  if (result.payload?.data === undefined) {
    throw new GameStatsApiError(result.response.status, '게임 전적 응답 형식이 올바르지 않습니다.');
  }

  return result.payload.data;
}

export function connectPubg(playerName: string) {
  return gameStatsRequest<PubgConnectionResponse>('/api/v1/pubg/connect', {
    method: 'POST',
    body: JSON.stringify({ playerName }),
  });
}

export function fetchPubgSummary() {
  return gameStatsRequest<PubgSummaryResponse>('/api/v1/pubg/me');
}

export function connectR6(playerName: string) {
  return gameStatsRequest<R6ConnectionResponse>('/api/v1/r6/connect', {
    method: 'POST',
    body: JSON.stringify({ playerName }),
  });
}

export function refreshR6Summary() {
  return gameStatsRequest<R6SummaryResponse>('/api/v1/r6/me/refresh', {
    method: 'POST',
  });
}

export function disconnectGameStats(gameName: GameName) {
  return gameStatsRequest<null>(GAME_STATS_DISCONNECT_PATH[gameName], {
    method: 'DELETE',
  });
}
