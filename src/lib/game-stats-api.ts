import { ApiError, AUTH_REQUIRED_MESSAGE, type ApiClientConfig, type ApiFailureReason, type ApiRequestOptions, apiRequest } from '@/lib/api-client';
import type { RepresentativeGame } from '@/lib/representative-tier';

export class GameStatsApiError extends ApiError {
  constructor(status: number, message: string, reason: ApiFailureReason = 'http') {
    super(message, status, reason);
    this.name = 'GameStatsApiError';
  }
}

export interface PubgConnectionResponse {
  connected: boolean;
  playerName: string;
}

export type GameName = 'PUBG' | 'R6' | 'LOL' | 'VALORANT';
export type StatsMode = 'RANKED' | 'NORMAL';

const GAME_STATS_DISCONNECT_PATH: Record<GameName, string> = {
  PUBG: '/api/v1/pubg/disconnect',
  R6: '/api/v1/r6/disconnect',
  LOL: '/api/v1/riot/disconnect',
  VALORANT: '/api/v1/valorant/disconnect',
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

export interface RiotConnectionResponse {
  connected: boolean;
  riotId: string;
}

export interface LolSummaryResponse {
  gameName: string;
  tierLabel: string | null;
  kda: number;
  winRate: number;
  games: number;
  connected: boolean;
}

/** 발로란트는 Riot(LoL)과 별개 연동이다. 플랫폼은 PC, 리전은 KR·AP만 지원한다. */
export type ValorantRegion = 'KR' | 'AP';

export interface ValorantConnectionResponse {
  connected: boolean;
  riotId: string;
  region: ValorantRegion;
  platform: 'PC';
}

/** kd·acs·headshotRate·winRate·matches는 최근 경쟁전(최대 10경기) 기준이다. */
export interface ValorantSummaryResponse {
  game: 'VALORANT';
  connected: boolean;
  riotId: string | null;
  region: ValorantRegion | null;
  platform: 'PC';
  tierLabel: string | null;
  peakTierLabel: string | null;
  rr: number | null;
  kd: number | null;
  acs: number | null;
  headshotRate: number | null;
  winRate: number | null;
  matches: number | null;
  updatedAt: string | null;
}

export function connectValorant(riotId: string, region: ValorantRegion) {
  return gameStatsRequest<ValorantConnectionResponse>('/api/v1/valorant/connect', {
    method: 'POST',
    body: JSON.stringify({ riotId, region }),
  });
}

export function refreshValorantSummary() {
  return gameStatsRequest<ValorantSummaryResponse>('/api/v1/valorant/me/refresh', {
    method: 'POST',
  });
}

export function connectRiot(riotId: string) {
  return gameStatsRequest<RiotConnectionResponse>('/api/v1/riot/connect', {
    method: 'POST',
    body: JSON.stringify({ riotId }),
  });
}

export function fetchLolSummary() {
  return gameStatsRequest<LolSummaryResponse>('/api/v1/riot/lol/me');
}

const GAME_STATS_CLIENT: ApiClientConfig = {
  toError: ({ reason, status, message }) => new GameStatsApiError(
    status,
    message ?? (reason === 'unauthenticated' || reason === 'blocked' || status === 401
      ? AUTH_REQUIRED_MESSAGE
      : reason === 'invalid-response'
        ? '게임 전적을 불러오는 중 오류가 발생했습니다.'
        : '게임 전적 요청에 실패했습니다.'),
    reason,
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

/** 대표 게임을 바꾼다(null이면 표시 안 함). 응답은 data: null이므로 호출자가 /auth/me로 다시 조회한다. */
export function updateRepresentativeGame(game: RepresentativeGame | null) {
  return gameStatsRequest<null>('/api/v1/users/me/representative-game', {
    method: 'PATCH',
    body: JSON.stringify({ game }),
  });
}
