import { ApiError, type ApiClientConfig, type ApiRequestOptions, apiRequest } from '@/lib/api-client';

export class GameStatsApiError extends ApiError {
  constructor(status: number, message: string) {
    super(message, status);
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

const GAME_STATS_CLIENT: ApiClientConfig = {
  toError: ({ reason, status, message }) => new GameStatsApiError(
    status,
    reason === 'unauthenticated'
      ? '로그인이 필요하거나 인증이 만료되었습니다.'
      : reason === 'invalid-response'
        ? '게임 전적 응답 형식이 올바르지 않습니다.'
        : message ?? '게임 전적 요청에 실패했습니다.',
  ),
};

function gameStatsRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, GAME_STATS_CLIENT, options);
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
